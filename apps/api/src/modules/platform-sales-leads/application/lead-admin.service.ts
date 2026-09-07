import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  LeadDurableIdempotencyService,
  LeadIdempotencyEquivalentRaceLostError,
  type LeadActionResult,
} from './lead-durable-idempotency.service';
import { LeadAuditLog } from './lead-audit.log';
import { LeadPlanFitService } from './lead-plan-fit.service';
import { isAllowedStageTransition, isTerminalStage } from './lead-stage-transitions';
import {
  assertLeadInScope,
  leadVisibilityWhere,
  resolveLeadVisibility,
} from './lead-visibility';
import {
  SalesLeadConflictError,
  SalesLeadForbiddenError,
  SalesLeadNotFoundError,
  SalesLeadValidationError,
} from '../domain/sales-lead.errors';
import type {
  PlanFitAdvisoryDto,
  SalesDemoStatus,
  SalesLeadDto,
  SalesLeadNoteDto,
  SalesLeadOwnershipHistoryDto,
  SalesLeadSource,
  SalesLeadStage,
  SalesLeadStageHistoryDto,
} from '../domain/sales-lead.types';
import {
  MAX_DESIRED_MODULE_KEYS,
  MAX_NOTE_BODY_CHARS,
  MAX_SPECIALTY_KEYS,
  SALES_LEAD_AUDIT_ACTIONS,
  SALES_LEAD_AUDIT_RESOURCE_TYPE,
  SALES_LEAD_PERMISSIONS,
  isSalesLeadsFailureInjectionActive,
} from '../platform-sales-leads.constants';

type Tx = Prisma.TransactionClient;

const SOURCES = new Set(['INBOUND', 'OUTBOUND', 'REFERRAL', 'PARTNER', 'EVENT', 'OTHER']);
const DEMO_STATUSES = new Set(['NONE', 'SCHEDULED', 'COMPLETED', 'CANCELLED']);
const SCRIPT_PATTERN = /<\s*script\b|javascript:|on\w+\s*=/i;

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function toDto(row: {
  id: string;
  stage: string;
  source: string;
  ownerRepresentativeId: string | null;
  organizationName: string;
  contactName: string;
  contactEmail: string | null;
  contactPhone: string | null;
  contactJobTitle: string | null;
  facilityTypeKey: string | null;
  specialtyKeys: unknown;
  desiredModuleKeys: unknown;
  estimatedUsers: number | null;
  estimatedProviders: number | null;
  estimatedLocations: number | null;
  nextActionType: string | null;
  nextActionDueAt: Date | null;
  nextActionNote: string | null;
  demoScheduledAt: Date | null;
  demoTimezone: string | null;
  demoStatus: string;
  demoNote: string | null;
  wonLostReason: string | null;
  linkedPlatformTenantId: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
}): SalesLeadDto {
  return {
    id: row.id,
    stage: row.stage as SalesLeadStage,
    source: row.source as SalesLeadSource,
    ownerRepresentativeId: row.ownerRepresentativeId,
    organizationName: row.organizationName,
    contactName: row.contactName,
    contactEmail: row.contactEmail,
    contactPhone: row.contactPhone,
    contactJobTitle: row.contactJobTitle,
    facilityTypeKey: row.facilityTypeKey,
    specialtyKeys: asStringArray(row.specialtyKeys),
    desiredModuleKeys: asStringArray(row.desiredModuleKeys),
    estimatedUsers: row.estimatedUsers,
    estimatedProviders: row.estimatedProviders,
    estimatedLocations: row.estimatedLocations,
    nextActionType: row.nextActionType,
    nextActionDueAt: row.nextActionDueAt?.toISOString() ?? null,
    nextActionNote: row.nextActionNote,
    demoScheduledAt: row.demoScheduledAt?.toISOString() ?? null,
    demoTimezone: row.demoTimezone,
    demoStatus: row.demoStatus as SalesDemoStatus,
    demoNote: row.demoNote,
    wonLostReason: row.wonLostReason,
    linkedPlatformTenantId: row.linkedPlatformTenantId,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function sanitizeNoteBody(raw: string): string {
  const body = (raw ?? '').trim();
  if (!body) throw new SalesLeadValidationError('Note body is required.');
  if (body.length > MAX_NOTE_BODY_CHARS) {
    throw new SalesLeadValidationError(`Note body exceeds ${MAX_NOTE_BODY_CHARS} characters.`);
  }
  if (SCRIPT_PATTERN.test(body) || /<\s*\/?\s*[a-z]/i.test(body)) {
    throw new SalesLeadValidationError('Notes must not contain HTML or script content.');
  }
  return body;
}

function normalizeKeyArray(keys: string[] | undefined, max: number, label: string): string[] {
  const list = (keys ?? []).map((k) => k.trim()).filter(Boolean);
  if (list.length > max) throw new SalesLeadValidationError(`${label} exceeds max ${max}.`);
  return [...new Set(list)];
}

function boundedInt(value: number | null | undefined, label: string): number | null {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    throw new SalesLeadValidationError(`${label} must be an integer between 0 and 1000000.`);
  }
  return value;
}

/**
 * Flexible Step 24 — Sales Lead administration.
 * Contract: docs/LEADS_AND_SALES_PIPELINE.md
 */
@Injectable()
export class LeadAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly durable: LeadDurableIdempotencyService,
    private readonly audit: LeadAuditLog,
    private readonly planFitService: LeadPlanFitService,
  ) {}

  assertPermission(perms: ReadonlySet<string>, key: string): void {
    if (!perms.has(key)) throw new SalesLeadForbiddenError(`Missing ${key}`);
  }

  private actorRoles(claims: JwtClaimsVO): string[] {
    const roles = (claims.roles as unknown as string[]) ?? [];
    return roles.length > 0 ? roles : ['platform'];
  }

  private async getScopedLead(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string) {
    const scope = await resolveLeadVisibility(this.prisma, claims.sub, perms);
    const row = await this.prisma.platformSalesLead.findUnique({ where: { id } });
    assertLeadInScope(scope, row);
    return row!;
  }

  async list(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: { page: number; pageSize: number; stage?: string; source?: string; search?: string },
  ): Promise<{ items: SalesLeadDto[]; total: number; page: number; pageSize: number }> {
    if (
      !perms.has(SALES_LEAD_PERMISSIONS.view) &&
      !perms.has(SALES_LEAD_PERMISSIONS.manage) &&
      !perms.has(SALES_LEAD_PERMISSIONS.assign)
    ) {
      throw new SalesLeadForbiddenError('Missing sales-lead.view');
    }
    const scope = await resolveLeadVisibility(this.prisma, claims.sub, perms);
    const where: Prisma.PlatformSalesLeadWhereInput = { ...leadVisibilityWhere(scope) };
    if (input.stage) where.stage = input.stage.toUpperCase() as never;
    if (input.source) where.source = input.source.toUpperCase() as never;
    if (input.search?.trim()) {
      const q = input.search.trim();
      where.OR = [
        { organizationName: { contains: q, mode: 'insensitive' } },
        { contactName: { contains: q, mode: 'insensitive' } },
        { contactEmail: { contains: q, mode: 'insensitive' } },
      ];
    }
    const [rows, total] = await Promise.all([
      this.prisma.platformSalesLead.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.platformSalesLead.count({ where }),
    ]);
    return { items: rows.map(toDto), total, page: input.page, pageSize: input.pageSize };
  }

  async getById(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string): Promise<SalesLeadDto> {
    if (
      !perms.has(SALES_LEAD_PERMISSIONS.view) &&
      !perms.has(SALES_LEAD_PERMISSIONS.manage) &&
      !perms.has(SALES_LEAD_PERMISSIONS.assign)
    ) {
      throw new SalesLeadForbiddenError('Missing sales-lead.view');
    }
    const row = await this.getScopedLead(claims, perms, id);
    return toDto(row);
  }

  async create(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: {
      organizationName: string;
      contactName: string;
      contactEmail?: string;
      contactPhone?: string;
      contactJobTitle?: string;
      source?: SalesLeadSource;
      ownerRepresentativeId?: string | null;
      facilityTypeKey?: string;
      specialtyKeys?: string[];
      desiredModuleKeys?: string[];
      estimatedUsers?: number;
      estimatedProviders?: number;
      estimatedLocations?: number;
      nextActionType?: string;
      nextActionDueAt?: string;
      nextActionNote?: string;
      linkedPlatformTenantId?: string | null;
      reason?: string;
    },
    idempotencyKey: string,
  ): Promise<SalesLeadDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.manage);
    const organizationName = (input.organizationName ?? '').trim();
    const contactName = (input.contactName ?? '').trim();
    if (!organizationName) throw new SalesLeadValidationError('organizationName is required.');
    if (!contactName) throw new SalesLeadValidationError('contactName is required.');
    const source = (input.source ?? 'OTHER').toUpperCase();
    if (!SOURCES.has(source)) throw new SalesLeadValidationError('Invalid source.');
    const specialtyKeys = normalizeKeyArray(input.specialtyKeys, MAX_SPECIALTY_KEYS, 'specialtyKeys');
    const desiredModuleKeys = normalizeKeyArray(
      input.desiredModuleKeys,
      MAX_DESIRED_MODULE_KEYS,
      'desiredModuleKeys',
    );

    let ownerRepresentativeId = input.ownerRepresentativeId ?? null;
    if (!perms.has(SALES_LEAD_PERMISSIONS.assign)) {
      const actorRep = await this.prisma.platformSalesRepresentative.findUnique({
        where: { platformUserId: claims.sub },
        select: { id: true },
      });
      if (!actorRep) throw new SalesLeadForbiddenError('Actor has no sales representative profile.');
      if (ownerRepresentativeId && ownerRepresentativeId !== actorRep.id) {
        throw new SalesLeadForbiddenError('Missing sales-lead.assign to set another owner.');
      }
      ownerRepresentativeId = actorRep.id;
    } else if (ownerRepresentativeId) {
      const owner = await this.prisma.platformSalesRepresentative.findUnique({
        where: { id: ownerRepresentativeId },
        select: { id: true },
      });
      if (!owner) throw new SalesLeadValidationError('ownerRepresentativeId not found.');
    }

    if (input.linkedPlatformTenantId) {
      const tenant = await this.prisma.platformTenant.findUnique({
        where: { id: input.linkedPlatformTenantId },
        select: { id: true },
      });
      if (!tenant) throw new SalesLeadValidationError('linkedPlatformTenantId not found.');
    }

    const operation = 'sales_lead.create';
    const leadId = randomUUID();
    const requestHash = this.durable.fingerprint({
      op: operation,
      organizationName,
      contactName,
      contactEmail: input.contactEmail ?? null,
      source,
      ownerRepresentativeId,
      facilityTypeKey: input.facilityTypeKey ?? null,
      specialtyKeys,
      desiredModuleKeys,
    });

    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesLead',
      resultResourceId: leadId,
    });
    if (gate.kind === 'replay') return this.getById(claims, perms, gate.result.targetId);

    if (isSalesLeadsFailureInjectionActive('after_idempotency_claim')) {
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw new SalesLeadValidationError('Injected after idempotency claim');
    }
    if (isSalesLeadsFailureInjectionActive('source_state_validation')) {
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw new SalesLeadValidationError('Injected source state validation failure');
    }

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        await client.platformSalesLead.create({
          data: {
            id: leadId,
            stage: 'NEW',
            source: source as never,
            ownerRepresentativeId,
            organizationName,
            contactName,
            contactEmail: input.contactEmail?.trim() || null,
            contactPhone: input.contactPhone?.trim() || null,
            contactJobTitle: input.contactJobTitle?.trim() || null,
            facilityTypeKey: input.facilityTypeKey?.trim() || null,
            specialtyKeys,
            desiredModuleKeys,
            estimatedUsers: boundedInt(input.estimatedUsers, 'estimatedUsers'),
            estimatedProviders: boundedInt(input.estimatedProviders, 'estimatedProviders'),
            estimatedLocations: boundedInt(input.estimatedLocations, 'estimatedLocations'),
            nextActionType: input.nextActionType?.trim() || null,
            nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null,
            nextActionNote: input.nextActionNote?.trim() || null,
            linkedPlatformTenantId: input.linkedPlatformTenantId ?? null,
          },
        });
        await client.platformSalesLeadStageHistory.create({
          data: {
            leadId,
            fromStage: null,
            toStage: 'NEW',
            actorPlatformUserId: claims.sub,
            reason: input.reason ?? null,
          },
        });
        if (ownerRepresentativeId) {
          await client.platformSalesLeadOwnershipHistory.create({
            data: {
              leadId,
              fromOwnerRepresentativeId: null,
              toOwnerRepresentativeId: ownerRepresentativeId,
              actorPlatformUserId: claims.sub,
              reason: input.reason ?? null,
            },
          });
        }
        const correlationId = resolveOperationCorrelationId({});
        const result: LeadActionResult = {
          accepted: true,
          replayed: false,
          action: operation,
          targetId: leadId,
          correlationId,
          result: 'accepted',
        };
        if (isSalesLeadsFailureInjectionActive('before_commit')) {
          throw new SalesLeadValidationError('Injected before commit');
        }
        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesLead',
          resultResourceId: leadId,
          result,
        });
        await this.audit.recordInTransaction(client, {
          action: SALES_LEAD_AUDIT_ACTIONS.CREATED,
          resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
          resourceId: leadId,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason: input.reason ?? null,
          correlationId,
          details: { stage: 'NEW', source, ownerRepresentativeId },
          result: 'success',
          descriptionEn: 'Sales lead created',
          descriptionAr: 'تم إنشاء عميل محتمل للمبيعات',
        });
      });
    } catch (err) {
      if (err instanceof LeadIdempotencyEquivalentRaceLostError) {
        return this.getById(claims, perms, err.resultResourceId);
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }

    if (isSalesLeadsFailureInjectionActive('after_commit_before_response')) {
      throw new SalesLeadValidationError('Injected after commit before response');
    }
    return this.getById(claims, perms, leadId);
  }

  async update(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      organizationName?: string;
      contactName?: string;
      contactEmail?: string | null;
      contactPhone?: string | null;
      contactJobTitle?: string | null;
      source?: SalesLeadSource;
      facilityTypeKey?: string | null;
      specialtyKeys?: string[];
      desiredModuleKeys?: string[];
      estimatedUsers?: number | null;
      estimatedProviders?: number | null;
      estimatedLocations?: number | null;
      nextActionType?: string | null;
      nextActionDueAt?: string | null;
      nextActionNote?: string | null;
      linkedPlatformTenantId?: string | null;
      expectedRowVersion: number;
      reason?: string;
    },
  ): Promise<SalesLeadDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.manage);
    const existing = await this.getScopedLead(claims, perms, id);
    if (isTerminalStage(existing.stage)) {
      throw new SalesLeadConflictError('Terminal leads cannot be updated.');
    }
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new SalesLeadConflictError('Row version conflict.');
    }
    if (isSalesLeadsFailureInjectionActive('occ_conflict')) {
      throw new SalesLeadConflictError('Injected OCC conflict');
    }

    const specialtyKeys =
      input.specialtyKeys !== undefined
        ? normalizeKeyArray(input.specialtyKeys, MAX_SPECIALTY_KEYS, 'specialtyKeys')
        : undefined;
    const desiredModuleKeys =
      input.desiredModuleKeys !== undefined
        ? normalizeKeyArray(input.desiredModuleKeys, MAX_DESIRED_MODULE_KEYS, 'desiredModuleKeys')
        : undefined;
    if (input.source && !SOURCES.has(input.source.toUpperCase())) {
      throw new SalesLeadValidationError('Invalid source.');
    }
    if (input.linkedPlatformTenantId) {
      const tenant = await this.prisma.platformTenant.findUnique({
        where: { id: input.linkedPlatformTenantId },
        select: { id: true },
      });
      if (!tenant) throw new SalesLeadValidationError('linkedPlatformTenantId not found.');
    }

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const result = await client.platformSalesLead.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: {
          ...(input.organizationName !== undefined
            ? { organizationName: input.organizationName.trim() }
            : {}),
          ...(input.contactName !== undefined ? { contactName: input.contactName.trim() } : {}),
          ...(input.contactEmail !== undefined
            ? { contactEmail: input.contactEmail?.trim() || null }
            : {}),
          ...(input.contactPhone !== undefined
            ? { contactPhone: input.contactPhone?.trim() || null }
            : {}),
          ...(input.contactJobTitle !== undefined
            ? { contactJobTitle: input.contactJobTitle?.trim() || null }
            : {}),
          ...(input.source !== undefined ? { source: input.source.toUpperCase() as never } : {}),
          ...(input.facilityTypeKey !== undefined
            ? { facilityTypeKey: input.facilityTypeKey?.trim() || null }
            : {}),
          ...(specialtyKeys !== undefined ? { specialtyKeys } : {}),
          ...(desiredModuleKeys !== undefined ? { desiredModuleKeys } : {}),
          ...(input.estimatedUsers !== undefined
            ? { estimatedUsers: boundedInt(input.estimatedUsers, 'estimatedUsers') }
            : {}),
          ...(input.estimatedProviders !== undefined
            ? { estimatedProviders: boundedInt(input.estimatedProviders, 'estimatedProviders') }
            : {}),
          ...(input.estimatedLocations !== undefined
            ? { estimatedLocations: boundedInt(input.estimatedLocations, 'estimatedLocations') }
            : {}),
          ...(input.nextActionType !== undefined
            ? { nextActionType: input.nextActionType?.trim() || null }
            : {}),
          ...(input.nextActionDueAt !== undefined
            ? { nextActionDueAt: input.nextActionDueAt ? new Date(input.nextActionDueAt) : null }
            : {}),
          ...(input.nextActionNote !== undefined
            ? { nextActionNote: input.nextActionNote?.trim() || null }
            : {}),
          ...(input.linkedPlatformTenantId !== undefined
            ? { linkedPlatformTenantId: input.linkedPlatformTenantId }
            : {}),
          rowVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new SalesLeadConflictError('Row version conflict.');
      const correlationId = resolveOperationCorrelationId({});
      await this.audit.recordInTransaction(client, {
        action: SALES_LEAD_AUDIT_ACTIONS.UPDATED,
        resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: this.actorRoles(claims),
        reason: input.reason ?? null,
        correlationId,
        details: { expectedRowVersion: input.expectedRowVersion },
        result: 'success',
        descriptionEn: 'Sales lead updated',
        descriptionAr: 'تم تحديث عميل محتمل للمبيعات',
      });
      return client.platformSalesLead.findUniqueOrThrow({ where: { id } });
    });
    return toDto(updated);
  }

  async assignOwner(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { ownerRepresentativeId: string | null; expectedRowVersion: number; reason?: string },
  ): Promise<SalesLeadDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.assign);
    const existing = await this.getScopedLead(claims, perms, id);
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new SalesLeadConflictError('Row version conflict.');
    }
    if (isSalesLeadsFailureInjectionActive('owner_assign_validation')) {
      throw new SalesLeadValidationError('Injected owner assign validation failure');
    }
    if (input.ownerRepresentativeId) {
      const owner = await this.prisma.platformSalesRepresentative.findUnique({
        where: { id: input.ownerRepresentativeId },
        select: { id: true },
      });
      if (!owner) throw new SalesLeadValidationError('ownerRepresentativeId not found.');
    }
    const fromOwner = existing.ownerRepresentativeId;
    const toOwner = input.ownerRepresentativeId;
    const action =
      fromOwner == null
        ? SALES_LEAD_AUDIT_ACTIONS.OWNER_ASSIGNED
        : SALES_LEAD_AUDIT_ACTIONS.OWNER_REASSIGNED;

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const result = await client.platformSalesLead.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: { ownerRepresentativeId: toOwner, rowVersion: { increment: 1 } },
      });
      if (result.count !== 1) throw new SalesLeadConflictError('Row version conflict.');
      await client.platformSalesLeadOwnershipHistory.create({
        data: {
          leadId: id,
          fromOwnerRepresentativeId: fromOwner,
          toOwnerRepresentativeId: toOwner,
          actorPlatformUserId: claims.sub,
          reason: input.reason ?? null,
        },
      });
      const correlationId = resolveOperationCorrelationId({});
      await this.audit.recordInTransaction(client, {
        action,
        resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: this.actorRoles(claims),
        reason: input.reason ?? null,
        correlationId,
        details: { fromOwnerRepresentativeId: fromOwner, toOwnerRepresentativeId: toOwner },
        result: 'success',
        descriptionEn: 'Sales lead ownership changed',
        descriptionAr: 'تم تغيير ملكية العميل المحتمل',
      });
      return client.platformSalesLead.findUniqueOrThrow({ where: { id } });
    });
    return toDto(updated);
  }

  async changeStage(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { stage: SalesLeadStage; expectedRowVersion: number; reason?: string; wonLostReason?: string },
    idempotencyKey?: string,
  ): Promise<SalesLeadDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.manage);
    const existing = await this.getScopedLead(claims, perms, id);
    const toStage = input.stage.toUpperCase() as SalesLeadStage;
    if (isSalesLeadsFailureInjectionActive('stage_transition_validation')) {
      throw new SalesLeadValidationError('Injected stage transition validation failure');
    }

    const operation = 'sales_lead.stage';
    const requestHash = this.durable.fingerprint({
      op: operation,
      id,
      to: toStage,
      expectedRowVersion: input.expectedRowVersion,
      wonLostReason: input.wonLostReason ?? input.reason ?? null,
    });
    const key = idempotencyKey?.trim();
    if (key) {
      const gate = await this.durable.claimOrReplay({
        actorId: claims.sub,
        operation,
        idempotencyKey: key,
        requestHash,
        resultResourceType: 'platformSalesLead',
        resultResourceId: id,
      });
      if (gate.kind === 'replay') return this.getById(claims, perms, gate.result.targetId);
    }

    if (existing.rowVersion !== input.expectedRowVersion) {
      if (key) {
        await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey: key });
      }
      throw new SalesLeadConflictError('Row version conflict.');
    }
    if (!isAllowedStageTransition(existing.stage, toStage)) {
      if (key) {
        await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey: key });
      }
      throw new SalesLeadValidationError(`Illegal stage transition ${existing.stage} → ${toStage}`);
    }
    if ((toStage === 'WON' || toStage === 'LOST') && !(input.wonLostReason ?? input.reason)?.trim()) {
      if (key) {
        await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey: key });
      }
      throw new SalesLeadValidationError('wonLostReason is required for terminal stages.');
    }

    try {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        return this.applyStageChange(client, claims, existing, toStage, input, key, requestHash, operation);
      });
      return toDto(updated);
    } catch (err) {
      if (err instanceof LeadIdempotencyEquivalentRaceLostError) {
        return this.getById(claims, perms, err.resultResourceId);
      }
      if (key) {
        await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey: key });
      }
      throw err;
    }
  }

  private async applyStageChange(
    client: Tx,
    claims: JwtClaimsVO,
    existing: { id: string; stage: string; rowVersion: number },
    toStage: SalesLeadStage,
    input: { expectedRowVersion: number; reason?: string; wonLostReason?: string },
    idempotencyKey: string | undefined,
    requestHash: string,
    operation: string,
  ) {
    if (toStage === 'WON' && isSalesLeadsFailureInjectionActive('won_side_effect_guard')) {
      throw new SalesLeadValidationError('Injected won side-effect guard');
    }
    const wonLostReason =
      toStage === 'WON' || toStage === 'LOST'
        ? (input.wonLostReason ?? input.reason ?? '').trim()
        : null;
    const result = await client.platformSalesLead.updateMany({
      where: { id: existing.id, rowVersion: input.expectedRowVersion },
      data: {
        stage: toStage as never,
        ...(wonLostReason ? { wonLostReason } : {}),
        rowVersion: { increment: 1 },
      },
    });
    if (result.count !== 1) throw new SalesLeadConflictError('Row version conflict.');
    await client.platformSalesLeadStageHistory.create({
      data: {
        leadId: existing.id,
        fromStage: existing.stage as never,
        toStage: toStage as never,
        actorPlatformUserId: claims.sub,
        reason: wonLostReason ?? input.reason ?? null,
      },
    });
    const correlationId = resolveOperationCorrelationId({});
    if (idempotencyKey) {
      await this.durable.completeInTransaction(client, {
        actorId: claims.sub,
        operation,
        idempotencyKey,
        requestHash,
        resultResourceType: 'platformSalesLead',
        resultResourceId: existing.id,
        result: {
          accepted: true,
          replayed: false,
          action: operation,
          targetId: existing.id,
          correlationId,
          result: 'accepted',
        },
      });
    }
    const auditAction =
      toStage === 'WON'
        ? SALES_LEAD_AUDIT_ACTIONS.WON
        : toStage === 'LOST'
          ? SALES_LEAD_AUDIT_ACTIONS.LOST
          : SALES_LEAD_AUDIT_ACTIONS.STAGE_CHANGED;
    await this.audit.recordInTransaction(client, {
      action: auditAction,
      resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
      resourceId: existing.id,
      actorId: claims.sub,
      actorRoles: this.actorRoles(claims),
      reason: wonLostReason ?? input.reason ?? null,
      correlationId,
      details: { fromStage: existing.stage, toStage },
      result: 'success',
      descriptionEn: `Sales lead stage changed to ${toStage}`,
      descriptionAr: `تم تغيير مرحلة العميل المحتمل إلى ${toStage}`,
    });
    return client.platformSalesLead.findUniqueOrThrow({ where: { id: existing.id } });
  }

  async markWon(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { expectedRowVersion: number; wonLostReason: string; reason?: string },
    idempotencyKey?: string,
  ): Promise<SalesLeadDto> {
    return this.changeStage(
      claims,
      perms,
      id,
      { stage: 'WON', expectedRowVersion: input.expectedRowVersion, wonLostReason: input.wonLostReason, reason: input.reason },
      idempotencyKey,
    );
  }

  async markLost(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { expectedRowVersion: number; wonLostReason: string; reason?: string },
    idempotencyKey?: string,
  ): Promise<SalesLeadDto> {
    return this.changeStage(
      claims,
      perms,
      id,
      { stage: 'LOST', expectedRowVersion: input.expectedRowVersion, wonLostReason: input.wonLostReason, reason: input.reason },
      idempotencyKey,
    );
  }

  async updateDemo(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      demoScheduledAt?: string | null;
      demoTimezone?: string | null;
      demoStatus: SalesDemoStatus;
      demoNote?: string | null;
      expectedRowVersion: number;
      reason?: string;
    },
  ): Promise<SalesLeadDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.manage);
    const existing = await this.getScopedLead(claims, perms, id);
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new SalesLeadConflictError('Row version conflict.');
    }
    const demoStatus = input.demoStatus.toUpperCase();
    if (!DEMO_STATUSES.has(demoStatus)) throw new SalesLeadValidationError('Invalid demoStatus.');

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const result = await client.platformSalesLead.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: {
          demoStatus: demoStatus as never,
          demoScheduledAt:
            input.demoScheduledAt === undefined
              ? undefined
              : input.demoScheduledAt
                ? new Date(input.demoScheduledAt)
                : null,
          demoTimezone:
            input.demoTimezone === undefined ? undefined : input.demoTimezone?.trim() || null,
          demoNote: input.demoNote === undefined ? undefined : input.demoNote?.trim() || null,
          rowVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) throw new SalesLeadConflictError('Row version conflict.');
      const correlationId = resolveOperationCorrelationId({});
      await this.audit.recordInTransaction(client, {
        action: SALES_LEAD_AUDIT_ACTIONS.DEMO_UPDATED,
        resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: this.actorRoles(claims),
        reason: input.reason ?? null,
        correlationId,
        details: { demoStatus },
        result: 'success',
        descriptionEn: 'Sales lead demo updated',
        descriptionAr: 'تم تحديث عرض العميل المحتمل',
      });
      return client.platformSalesLead.findUniqueOrThrow({ where: { id } });
    });
    return toDto(updated);
  }

  async addNote(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { body: string },
  ): Promise<SalesLeadNoteDto> {
    this.assertPermission(perms, SALES_LEAD_PERMISSIONS.manage);
    await this.getScopedLead(claims, perms, id);
    if (isSalesLeadsFailureInjectionActive('note_sanitization')) {
      throw new SalesLeadValidationError('Injected note sanitization failure');
    }
    const body = sanitizeNoteBody(input.body);
    const noteId = randomUUID();
    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformSalesLeadNote.create({
        data: { id: noteId, leadId: id, body, createdById: claims.sub },
      });
      const correlationId = resolveOperationCorrelationId({});
      await this.audit.recordInTransaction(client, {
        action: SALES_LEAD_AUDIT_ACTIONS.NOTE_ADDED,
        resourceType: SALES_LEAD_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: this.actorRoles(claims),
        correlationId,
        details: { noteId },
        result: 'success',
        descriptionEn: 'Sales lead note added',
        descriptionAr: 'تمت إضافة ملاحظة للعميل المحتمل',
      });
    });
    const note = await this.prisma.platformSalesLeadNote.findUniqueOrThrow({ where: { id: noteId } });
    return {
      id: note.id,
      leadId: note.leadId,
      body: note.body,
      createdById: note.createdById,
      createdAt: note.createdAt.toISOString(),
    };
  }

  async listNotes(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesLeadNoteDto[]> {
    await this.getScopedLead(claims, perms, id);
    const rows = await this.prisma.platformSalesLeadNote.findMany({
      where: { leadId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
    return rows.map((n) => ({
      id: n.id,
      leadId: n.leadId,
      body: n.body,
      createdById: n.createdById,
      createdAt: n.createdAt.toISOString(),
    }));
  }

  async listStageHistory(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesLeadStageHistoryDto[]> {
    await this.getScopedLead(claims, perms, id);
    const rows = await this.prisma.platformSalesLeadStageHistory.findMany({
      where: { leadId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      leadId: r.leadId,
      fromStage: (r.fromStage as SalesLeadStage | null) ?? null,
      toStage: r.toStage as SalesLeadStage,
      actorPlatformUserId: r.actorPlatformUserId,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async listOwnershipHistory(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesLeadOwnershipHistoryDto[]> {
    await this.getScopedLead(claims, perms, id);
    const rows = await this.prisma.platformSalesLeadOwnershipHistory.findMany({
      where: { leadId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      leadId: r.leadId,
      fromOwnerRepresentativeId: r.fromOwnerRepresentativeId,
      toOwnerRepresentativeId: r.toOwnerRepresentativeId,
      actorPlatformUserId: r.actorPlatformUserId,
      reason: r.reason,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getPlanFit(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<PlanFitAdvisoryDto> {
    const lead = await this.getById(claims, perms, id);
    return this.planFitService.evaluate(lead);
  }
}
