import { Inject, Injectable } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PasswordHasher } from '../../identity/infrastructure/password-hasher';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformSessionRevocationService } from '../../auth/application/services/platform-session-revocation.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { PlatformInvitationRepository } from '../../auth/infrastructure/repositories/prisma-platform-rbac.repositories';
import { PLATFORM_RBAC_CONFIG, type PlatformRbacConfig } from '../../auth/platform-rbac/config/platform-rbac-config';
import {
  PLATFORM_INVITATION_DELIVERY,
  type PlatformInvitationDeliveryPort,
  redactEmailForLogs,
} from '../../auth/infrastructure/services/platform-invitation-delivery.port';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import { SalesDurableIdempotencyService, SalesIdempotencyEquivalentRaceLostError, type SalesActionResult } from './sales-durable-idempotency.service';
import { SalesAuditLog } from './sales-audit.log';
import { assertGrantableViaSalesManagePath } from './sales-grantability';
import { assertNoManagerCycle } from './sales-manager-graph';
import {
  SalesRepConflictError,
  SalesRepForbiddenError,
  SalesRepNotFoundError,
  SalesRepValidationError,
} from '../domain/sales-representative.errors';
import type { SalesRepresentativeDto } from '../domain/sales-representative.types';
import {
  SALES_AUDIT_ACTIONS,
  SALES_AUDIT_RESOURCE_TYPE,
  SALES_REP_PERMISSIONS,
  isSalesFailureInjectionActive,
} from '../platform-sales-representatives.constants';

type Tx = Prisma.TransactionClient;

function toDto(row: {
  id: string;
  platformUserId: string;
  status: string;
  managerRepresentativeId: string | null;
  regionCode: string | null;
  territoryCode: string | null;
  targetAmount: unknown;
  targetCurrency: string | null;
  targetPeriod: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
  platformUser: { email: string; displayName: string | null };
  roleKeys: string[];
}): SalesRepresentativeDto {
  return {
    id: row.id,
    platformUserId: row.platformUserId,
    email: row.platformUser.email,
    displayName: row.platformUser.displayName,
    status: row.status,
    managerRepresentativeId: row.managerRepresentativeId,
    regionCode: row.regionCode,
    territoryCode: row.territoryCode,
    targetAmount: row.targetAmount == null ? null : String(row.targetAmount),
    targetCurrency: row.targetCurrency,
    targetPeriod: row.targetPeriod,
    roleKeys: row.roleKeys,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Flexible Step 23 — Sales Representative administration service.
 * All mutations: permission-gated, durable-idempotent, OCC-protected where a row
 * is mutated, and paired 1:1 with a Model A audit entry on success only.
 */
@Injectable()
export class SalesRepresentativeAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    private readonly assurance: PlatformAssuranceService,
    private readonly revocations: PlatformSessionRevocationService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY) private readonly refreshes: PlatformRefreshTokenRepository,
    private readonly invitations: PlatformInvitationRepository,
    @Inject(PLATFORM_RBAC_CONFIG) private readonly rbacConfig: PlatformRbacConfig,
    @Inject(PLATFORM_INVITATION_DELIVERY) private readonly invitationDelivery: PlatformInvitationDeliveryPort,
    private readonly durable: SalesDurableIdempotencyService,
    private readonly audit: SalesAuditLog,
  ) {}

  assertPermission(perms: ReadonlySet<string>, key: string): void {
    if (!perms.has(key)) {
      throw new SalesRepForbiddenError(`Missing ${key}`);
    }
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (isSalesFailureInjectionActive('step_up_validation')) {
      throw new SalesRepForbiddenError('Step-up verification is required for this action.');
    }
    if (!claims.sessionId) throw new SalesRepForbiddenError('Fresh step-up required.');
    const session = await this.refreshes.findBySessionId(claims.sessionId);
    if (!session) throw new SalesRepForbiddenError('Fresh step-up required.');
    this.assurance.requireStepUp(session);
  }

  private async findRow(client: Tx | PrismaService, id: string) {
    return (client as Tx).platformSalesRepresentative.findUnique({
      where: { id },
      include: { platformUser: { select: { email: true, displayName: true } } },
    });
  }

  private async withRoleKeys(client: Tx | PrismaService, platformUserId: string): Promise<string[]> {
    const rows = await (client as Tx).platformUserRole.findMany({
      where: { platformUserId, revokedAt: null },
      select: { roleKey: true },
      orderBy: { roleKey: 'asc' },
    });
    return rows.map((r) => r.roleKey);
  }

  async getById(id: string): Promise<SalesRepresentativeDto> {
    const row = await this.findRow(this.prisma, id);
    if (!row) throw new SalesRepNotFoundError();
    const roleKeys = await this.withRoleKeys(this.prisma, row.platformUserId);
    return toDto({ ...row, roleKeys });
  }

  async list(input: { page: number; pageSize: number; status?: string; search?: string }): Promise<{
    items: SalesRepresentativeDto[];
    total: number;
    page: number;
    pageSize: number;
  }> {
    const where: Prisma.PlatformSalesRepresentativeWhereInput = {};
    if (input.status) where.status = input.status.toUpperCase() as never;
    if (input.search?.trim()) {
      where.platformUser = { email: { contains: input.search.trim(), mode: 'insensitive' } };
    }
    const [rows, total] = await Promise.all([
      this.prisma.platformSalesRepresentative.findMany({
        where,
        include: { platformUser: { select: { email: true, displayName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.platformSalesRepresentative.count({ where }),
    ]);
    const items = await Promise.all(
      rows.map(async (row) => toDto({ ...row, roleKeys: await this.withRoleKeys(this.prisma, row.platformUserId) })),
    );
    return { items, total, page: input.page, pageSize: input.pageSize };
  }

  // ── Create (A01) ──────────────────────────────────────────────────────────
  async create(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: {
      email: string;
      displayName?: string;
      regionCode?: string;
      territoryCode?: string;
      targetAmount?: number;
      targetCurrency?: string;
      targetPeriod?: 'MONTH' | 'QUARTER' | 'YEAR';
      reason?: string;
    },
    idempotencyKey: string,
  ): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    await this.requireFreshStepUp(claims);
    const email = input.email.toLowerCase().trim();
    const operation = 'sales_representative.create';
    const requestHash = this.durable.fingerprint({
      op: operation,
      email,
      regionCode: input.regionCode ?? null,
      territoryCode: input.territoryCode ?? null,
    });
    const representativeId = randomUUID();

    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesRepresentative',
      resultResourceId: representativeId,
    });
    if (gate.kind === 'replay') {
      return this.getById(gate.result.targetId);
    }

    if (isSalesFailureInjectionActive('source_state_validation')) {
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw new SalesRepValidationError('Injected source state validation failure');
    }

    try {
      let createdUserId = '';
      await this.prisma.withPlatformBypass(async (client) => {
        const existing = await client.platformUser.findUnique({ where: { email } });
        if (existing) throw new SalesRepConflictError('A platform user with this email already exists.');

        if (isSalesFailureInjectionActive('password_hash')) {
          throw new SalesRepValidationError('Injected password hash failure');
        }
        const passwordHash = await PasswordHasher.hash(randomBytes(32).toString('hex'));
        const user = await client.platformUser.create({
          data: {
            id: randomUUID(),
            email,
            passwordHash,
            displayName: input.displayName ?? null,
            isActive: true,
            status: 'pending_activation',
          },
        });
        createdUserId = user.id;

        if (isSalesFailureInjectionActive('role_assignment')) {
          throw new SalesRepValidationError('Injected role assignment failure');
        }
        await client.platformUserRole.create({
          data: {
            platformUserId: user.id,
            roleKey: 'sales_representative',
            assignedById: claims.sub,
            reason: input.reason,
          },
        });

        await client.platformSalesRepresentative.create({
          data: {
            id: representativeId,
            platformUserId: user.id,
            status: 'PENDING_ACTIVATION',
            regionCode: input.regionCode ?? null,
            territoryCode: input.territoryCode ?? null,
            targetAmount: input.targetAmount ?? null,
            targetCurrency: input.targetCurrency ?? null,
            targetPeriod: input.targetPeriod ?? null,
          },
        });

        if (isSalesFailureInjectionActive('before_commit')) {
          throw new SalesRepValidationError('Injected before commit failure');
        }

        const correlationId = resolveOperationCorrelationId();
        const result: SalesActionResult = {
          accepted: true,
          replayed: false,
          action: operation,
          targetId: representativeId,
          correlationId,
          result: 'created',
        };
        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesRepresentative',
          resultResourceId: representativeId,
          result,
        });
        await this.audit.recordInTransaction(client, {
          action: SALES_AUDIT_ACTIONS.A01_CREATED,
          resourceType: SALES_AUDIT_RESOURCE_TYPE,
          resourceId: representativeId,
          actorId: claims.sub,
          actorRoles: ['platform'],
          reason: input.reason,
          correlationId,
          result: 'success',
          descriptionEn: 'Sales representative created',
          descriptionAr: 'تم إنشاء ممثل مبيعات',
          details: { platformUserId: user.id, emailRedacted: redactEmailForLogs(email) },
        });
      });

      // Best-effort invitation delivery — outside the DB transaction (external, non-reversible).
      if (!isSalesFailureInjectionActive('invitation_delivery')) {
        try {
          const raw = randomBytes(32).toString('base64url');
          const expiresAt = new Date(Date.now() + this.rbacConfig.invitationTtlSeconds * 1000);
          const invitation = await this.invitations.create({
            platformUserId: createdUserId,
            email,
            tokenHash: createHash('sha256').update(raw).digest('hex'),
            invitedById: claims.sub,
            roleKeysJson: JSON.stringify(['sales_representative']),
            expiresAt,
          });
          const activationUrl = `${this.rbacConfig.invitationAppOrigin}/activate?token=${encodeURIComponent(raw)}`;
          await this.invitationDelivery.deliver({
            recipientEmail: email,
            activationUrl,
            invitationId: invitation.id,
            platformUserId: createdUserId,
            expiresAt,
            correlationId: resolveOperationCorrelationId({ explicit: null }),
            templateId: 'platform_user_invitation',
          });
        } catch {
          // Delivery failure never invalidates the created representative record.
        }
      }

      if (isSalesFailureInjectionActive('after_commit_before_response')) {
        throw new SalesRepValidationError('Injected after commit before response failure');
      }
      return this.getById(representativeId);
    } catch (err) {
      if (err instanceof SalesIdempotencyEquivalentRaceLostError) {
        return this.getById(err.resultResourceId);
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }
  }

  // ── Profile / region / territory (A02/A03/A04) ──────────────────────────────
  async updateProfile(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { regionCode?: string | null; territoryCode?: string | null; displayName?: string; expectedRowVersion: number; reason?: string },
  ): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();
    if (current.rowVersion !== input.expectedRowVersion) {
      throw new SalesRepConflictError('Representative was modified by another request.');
    }

    const regionChanged = input.regionCode !== undefined && input.regionCode !== current.regionCode;
    const territoryChanged = input.territoryCode !== undefined && input.territoryCode !== current.territoryCode;
    const nameChanged = input.displayName !== undefined && input.displayName !== current.platformUser.displayName;

    let action: string = SALES_AUDIT_ACTIONS.A02_PROFILE_UPDATED;
    if (regionChanged && !territoryChanged && !nameChanged) action = SALES_AUDIT_ACTIONS.A03_REGION_UPDATED;
    else if (territoryChanged && !regionChanged && !nameChanged) action = SALES_AUDIT_ACTIONS.A04_TERRITORY_UPDATED;

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSalesRepresentative.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: {
          regionCode: input.regionCode === undefined ? undefined : input.regionCode,
          territoryCode: input.territoryCode === undefined ? undefined : input.territoryCode,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new SalesRepConflictError('Representative was modified by another request.');
      if (input.displayName !== undefined) {
        await client.platformUser.update({ where: { id: current.platformUserId }, data: { displayName: input.displayName } });
      }
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason: input.reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative profile updated',
        descriptionAr: 'تم تحديث ملف ممثل المبيعات',
        details: { regionChanged, territoryChanged, nameChanged },
      });
    });
    return this.getById(id);
  }

  // ── Target (A07) ─────────────────────────────────────────────────────────
  async updateTarget(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      targetAmount?: number | null;
      targetCurrency?: string | null;
      targetPeriod?: 'MONTH' | 'QUARTER' | 'YEAR' | null;
      expectedRowVersion: number;
      reason?: string;
    },
  ): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();
    if (current.rowVersion !== input.expectedRowVersion) {
      throw new SalesRepConflictError('Representative was modified by another request.');
    }
    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSalesRepresentative.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: {
          targetAmount: input.targetAmount === undefined ? undefined : input.targetAmount,
          targetCurrency: input.targetCurrency === undefined ? undefined : input.targetCurrency,
          targetPeriod: input.targetPeriod === undefined ? undefined : (input.targetPeriod as never),
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new SalesRepConflictError('Representative was modified by another request.');
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A07_TARGET_UPDATED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason: input.reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative target updated',
        descriptionAr: 'تم تحديث هدف ممثل المبيعات',
        details: {},
      });
    });
    return this.getById(id);
  }

  // ── Manager assign/reassign (A05/A06, M01-M08) ──────────────────────────────
  async assignManager(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { managerRepresentativeId: string | null; expectedRowVersion: number; reason?: string },
  ): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();
    if (current.rowVersion !== input.expectedRowVersion) {
      throw new SalesRepConflictError('Representative was modified by another request.');
    }

    if (isSalesFailureInjectionActive('manager_cycle_check')) {
      throw new SalesRepValidationError('Injected manager cycle check failure');
    }

    if (input.managerRepresentativeId) {
      const manager = await this.prisma.platformSalesRepresentative.findUnique({
        where: { id: input.managerRepresentativeId },
      });
      if (!manager) throw new SalesRepNotFoundError('Manager representative not found.');
      if (manager.status === 'DISABLED') {
        throw new SalesRepValidationError('Manager representative is disabled and cannot be assigned.');
      }
      await assertNoManagerCycle(id, input.managerRepresentativeId, async (repId) => {
        const node = await this.prisma.platformSalesRepresentative.findUnique({
          where: { id: repId },
          select: { id: true, managerRepresentativeId: true },
        });
        return node;
      });
    }

    const wasAssigned = current.managerRepresentativeId !== null;
    const action = wasAssigned ? SALES_AUDIT_ACTIONS.A06_MANAGER_REASSIGNED : SALES_AUDIT_ACTIONS.A05_MANAGER_ASSIGNED;

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSalesRepresentative.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: { managerRepresentativeId: input.managerRepresentativeId, rowVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new SalesRepConflictError('Representative was modified by another request.');
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason: input.reason,
        correlationId,
        result: 'success',
        descriptionEn: wasAssigned ? 'Sales representative manager reassigned' : 'Sales representative manager assigned',
        descriptionAr: wasAssigned ? 'أعيد تعيين مدير ممثل المبيعات' : 'تم تعيين مدير ممثل المبيعات',
        details: { managerRepresentativeId: input.managerRepresentativeId },
      });
    });
    return this.getById(id);
  }

  // ── Lifecycle: activate / suspend / reactivate (A10/A11/A12) ────────────────
  async activate(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, reason?: string): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();
    if (current.status === 'DISABLED') throw new SalesRepForbiddenError('Disabled representatives cannot be activated.');
    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformSalesRepresentative.update({
        where: { id },
        data: { status: 'ACTIVE', rowVersion: { increment: 1 } },
      });
      await client.platformUser.updateMany({
        where: { id: current.platformUserId },
        data: { status: 'active', isActive: true, suspendedAt: null, suspendedById: null, suspendedReason: null },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A10_ACTIVATED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative activated',
        descriptionAr: 'تم تفعيل ممثل المبيعات',
        details: {},
      });
    });
    await this.authz.bumpAuthzRevision(current.platformUserId);
    return this.getById(id);
  }

  async suspend(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, reason: string): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    if (!reason?.trim()) throw new SalesRepValidationError('Suspension reason is required.');
    await this.requireFreshStepUp(claims);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformSalesRepresentative.update({
        where: { id },
        data: { status: 'SUSPENDED', rowVersion: { increment: 1 } },
      });
      await client.platformUser.updateMany({
        where: { id: current.platformUserId },
        data: {
          status: 'suspended',
          isActive: false,
          suspendedAt: new Date(),
          suspendedById: claims.sub,
          suspendedReason: reason.trim(),
        },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A11_SUSPENDED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative suspended',
        descriptionAr: 'تم تعليق ممثل المبيعات',
        details: {},
      });
    });
    await this.authz.bumpAuthzRevision(current.platformUserId);
    if (!isSalesFailureInjectionActive('suspend_session_revocation')) {
      await this.revocations.revokeAllForUser(current.platformUserId, 'suspended');
    }
    return this.getById(id);
  }

  async reactivate(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, reason: string): Promise<SalesRepresentativeDto> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    if (!reason?.trim()) throw new SalesRepValidationError('Reactivation reason is required.');
    await this.requireFreshStepUp(claims);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformSalesRepresentative.update({
        where: { id },
        data: { status: 'ACTIVE', rowVersion: { increment: 1 } },
      });
      await client.platformUser.updateMany({
        where: { id: current.platformUserId },
        data: { status: 'active', isActive: true, suspendedAt: null, suspendedById: null, suspendedReason: null },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A12_REACTIVATED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative reactivated',
        descriptionAr: 'أعيد تفعيل ممثل المبيعات',
        details: {},
      });
    });
    // Reactivation never restores prior sessions — a fresh login/session is required.
    await this.authz.bumpAuthzRevision(current.platformUserId);
    return this.getById(id);
  }

  // ── Sessions (A13) ───────────────────────────────────────────────────────
  async revokeSessions(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, reason: string): Promise<{ revoked: number }> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    if (!reason?.trim()) throw new SalesRepValidationError('Revocation reason is required.');
    await this.requireFreshStepUp(claims);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();

    const revoked = await this.revocations.revokeAllForUser(current.platformUserId, reason.trim());
    await this.audit.record({
      action: SALES_AUDIT_ACTIONS.A13_SESSIONS_REVOKED,
      resourceType: SALES_AUDIT_RESOURCE_TYPE,
      resourceId: id,
      actorId: claims.sub,
      actorRoles: ['platform'],
      reason,
      result: 'success',
      descriptionEn: 'Sales representative sessions revoked',
      descriptionAr: 'تم إلغاء جلسات ممثل المبيعات',
      details: { revoked },
    });
    return { revoked };
  }

  // ── Roles (A08/A09) — grantability frozen to sales_representative only ────
  async assignRole(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, roleKey: string, reason?: string): Promise<{ ok: true }> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    assertGrantableViaSalesManagePath(roleKey);
    await this.requireFreshStepUp(claims);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformUserRole.upsert({
        where: { platformUserId_roleKey: { platformUserId: current.platformUserId, roleKey } },
        create: { platformUserId: current.platformUserId, roleKey, assignedById: claims.sub, reason },
        update: { revokedAt: null, revokedById: null, revokeReason: null, assignedById: claims.sub, reason, assignedAt: new Date() },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A08_ROLE_ASSIGNED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative role assigned',
        descriptionAr: 'تم تعيين دور لممثل المبيعات',
        details: { roleKey },
      });
    });
    await this.authz.bumpAuthzRevision(current.platformUserId);
    return { ok: true };
  }

  async removeRole(claims: JwtClaimsVO, perms: ReadonlySet<string>, id: string, roleKey: string, reason?: string): Promise<{ ok: true }> {
    this.assertPermission(perms, SALES_REP_PERMISSIONS.manage);
    await this.requireFreshStepUp(claims);
    const current = await this.findRow(this.prisma, id);
    if (!current) throw new SalesRepNotFoundError();

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformUserRole.updateMany({
        where: { platformUserId: current.platformUserId, roleKey, revokedAt: null },
        data: { revokedAt: new Date(), revokedById: claims.sub, revokeReason: reason },
      });
      const correlationId = resolveOperationCorrelationId();
      await this.audit.recordInTransaction(client, {
        action: SALES_AUDIT_ACTIONS.A09_ROLE_REMOVED,
        resourceType: SALES_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: ['platform'],
        reason,
        correlationId,
        result: 'success',
        descriptionEn: 'Sales representative role removed',
        descriptionAr: 'تمت إزالة دور من ممثل المبيعات',
        details: { roleKey },
      });
    });
    await this.authz.bumpAuthzRevision(current.platformUserId);
    return { ok: true };
  }
}
