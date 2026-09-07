import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  TrialDurableIdempotencyService,
  TrialIdempotencyEquivalentRaceLostError,
  type TrialActionResult,
} from './trial-durable-idempotency.service';
import { TrialAuditLog } from './trial-audit.log';
import { TrialProvisioningAdapter } from './trial-provisioning.adapter';
import {
  resolvePublishedPlanVersion,
  validateTrialCatalogSelection,
} from './trial-catalog-validation';
import {
  addDays,
  assertExtensionDays,
  isExpiredAt,
  resolveInitialDurationDays,
  resolveMaxExtensions,
} from './trial-duration-policy';
import {
  assertTrialInScope,
  hasTrialAllScope,
  resolveTrialVisibility,
  trialVisibilityWhere,
} from './trial-visibility';
import {
  SalesTrialConflictError,
  SalesTrialForbiddenError,
  SalesTrialNotFoundError,
  SalesTrialValidationError,
} from '../domain/sales-trial.errors';
import type {
  SalesTrialConversionDto,
  SalesTrialDto,
  SalesTrialExtensionDto,
  SalesTrialStatus,
  TrialAttributionSnapshot,
  TrialGrantDispositionInput,
  TrialOnlyGrant,
} from '../domain/sales-trial.types';
import {
  MAX_TRIAL_REASON_CHARS,
  SALES_TRIAL_AUDIT_ACTIONS,
  SALES_TRIAL_AUDIT_RESOURCE_TYPE,
  SALES_TRIAL_OPERATIONS,
  SALES_TRIAL_PERMISSIONS,
  isSalesTrialsFailureInjectionActive,
} from '../platform-sales-trials.constants';

type TrialRow = {
  id: string;
  status: string;
  organizationName: string;
  platformTenantId: string | null;
  originatingLeadId: string | null;
  ownerRepresentativeId: string | null;
  trialPlanVersionId: string;
  facilityTypeKey: string;
  selectedSpecialtyKeys: unknown;
  selectedModuleKeys: unknown;
  attributionSnapshotJson: unknown;
  trialOnlyGrantsJson: unknown;
  startsAt: Date | null;
  expiresAt: Date | null;
  maxExtensions: number;
  extensionCount: number;
  commercialConfigId: string | null;
  provisioningRequestId: string | null;
  expiredAt: Date | null;
  cancelledAt: Date | null;
  cancellationReason: string | null;
  rowVersion: number;
  createdAt: Date;
  updatedAt: Date;
};

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === 'string');
}

function asGrantArray(value: unknown): TrialOnlyGrant[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((g): g is Record<string, unknown> => !!g && typeof g === 'object')
    .map((g) => ({
      grantKey: String(g.grantKey ?? ''),
      kind: (g.kind === 'OVERRIDE' ? 'OVERRIDE' : 'ADD_ON') as TrialOnlyGrant['kind'],
      referenceId: (g.referenceId as string | null | undefined) ?? null,
      trialOnly: g.trialOnly !== false,
    }))
    .filter((g) => g.grantKey.length > 0);
}

export function trialToDto(row: TrialRow): SalesTrialDto {
  const attribution = row.attributionSnapshotJson as TrialAttributionSnapshot | null;
  return {
    id: row.id,
    status: row.status as SalesTrialStatus,
    organizationName: row.organizationName,
    platformTenantId: row.platformTenantId,
    originatingLeadId: row.originatingLeadId,
    ownerRepresentativeId: row.ownerRepresentativeId,
    trialPlanVersionId: row.trialPlanVersionId,
    facilityTypeKey: row.facilityTypeKey,
    selectedSpecialtyKeys: asStringArray(row.selectedSpecialtyKeys),
    selectedModuleKeys: asStringArray(row.selectedModuleKeys),
    startsAt: row.startsAt?.toISOString() ?? null,
    expiresAt: row.expiresAt?.toISOString() ?? null,
    maxExtensions: row.maxExtensions,
    extensionCount: row.extensionCount,
    commercialConfigId: row.commercialConfigId,
    provisioningRequestId: row.provisioningRequestId,
    trialOnlyGrants: asGrantArray(row.trialOnlyGrantsJson),
    attributionSnapshot:
      attribution && typeof attribution === 'object' && 'frozenAt' in attribution
        ? attribution
        : null,
    expiredAt: row.expiredAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    cancellationReason: row.cancellationReason,
    rowVersion: row.rowVersion,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Config fields are frozen once the Trial has runtime effect (ACTIVE or terminal). */
const CONFIG_EDITABLE_STATUSES = new Set(['DRAFT', 'PENDING_PROVISIONING']);
const TERMINAL_STATUSES = new Set(['EXPIRED', 'CONVERTED', 'CANCELLED']);

/**
 * Flexible Step 25 — governed Trial administration.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 *
 * Trial governance lives here; entitlements never do. Every runtime entitlement
 * consequence flows through the Step 16 commercial snapshot and Step 18 EER.
 */
@Injectable()
export class TrialAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly durable: TrialDurableIdempotencyService,
    private readonly audit: TrialAuditLog,
    private readonly provisioning: TrialProvisioningAdapter,
  ) {}

  private clock: () => Date = () => new Date();

  /** Test seam — injectable UTC clock for expiry-boundary cases. */
  setClock(clock: () => Date): void {
    this.clock = clock;
  }

  now(): Date {
    return this.clock();
  }

  assertPermission(perms: ReadonlySet<string>, key: string): void {
    if (!perms.has(key)) throw new SalesTrialForbiddenError(`Missing ${key}`);
  }

  private actorRoles(claims: JwtClaimsVO): string[] {
    const roles = (claims.roles as unknown as string[]) ?? [];
    return roles.length > 0 ? roles : ['platform'];
  }

  private async getScopedTrial(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<TrialRow> {
    const scope = await resolveTrialVisibility(this.prisma, claims.sub, perms);
    const row = await this.prisma.platformSalesTrial.findUnique({ where: { id } });
    assertTrialInScope(scope, row);
    return row as unknown as TrialRow;
  }

  async list(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: { page: number; pageSize: number; status?: string; search?: string },
  ): Promise<{ items: SalesTrialDto[]; total: number; page: number; pageSize: number }> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.view);
    const scope = await resolveTrialVisibility(this.prisma, claims.sub, perms);
    const where: Prisma.PlatformSalesTrialWhereInput = { ...trialVisibilityWhere(scope) };
    if (input.status) where.status = input.status.toUpperCase() as never;
    if (input.search?.trim()) {
      where.organizationName = { contains: input.search.trim(), mode: 'insensitive' };
    }
    const [rows, total] = await Promise.all([
      this.prisma.platformSalesTrial.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.platformSalesTrial.count({ where }),
    ]);
    return {
      items: (rows as unknown as TrialRow[]).map(trialToDto),
      total,
      page: input.page,
      pageSize: input.pageSize,
    };
  }

  async getById(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesTrialDto> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.view);
    return trialToDto(await this.getScopedTrial(claims, perms, id));
  }

  // ─── create ────────────────────────────────────────────────────────────────

  async create(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    input: {
      organizationName: string;
      facilityTypeKey: string;
      trialPlanVersionId: string;
      selectedSpecialtyKeys?: string[];
      selectedModuleKeys?: string[];
      originatingLeadId?: string | null;
      ownerRepresentativeId?: string | null;
      platformTenantId?: string | null;
      durationDays?: number | null;
      maxExtensions?: number | null;
      /** `trialOnly` defaults to true; callers only opt out explicitly. */
      trialOnlyGrants?: Array<Omit<TrialOnlyGrant, 'trialOnly'> & { trialOnly?: boolean }>;
      reason?: string;
    },
    idempotencyKey: string,
  ): Promise<SalesTrialDto> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.create);
    const organizationName = (input.organizationName ?? '').trim();
    if (!organizationName) {
      throw new SalesTrialValidationError('organizationName is required.', 'organization_required');
    }

    const selection = await validateTrialCatalogSelection(this.prisma, {
      facilityTypeKey: input.facilityTypeKey,
      specialtyKeys: input.selectedSpecialtyKeys,
      moduleKeys: input.selectedModuleKeys,
    });
    const planVersion = await resolvePublishedPlanVersion(
      this.prisma,
      input.trialPlanVersionId,
      'trial',
    );
    const durationDays = resolveInitialDurationDays({
      requestedDays: input.durationDays ?? null,
      planTrialDefaultEnabled: planVersion.trialDefaultEnabled,
      planTrialDefaultDays: planVersion.trialDefaultDays,
    });
    const maxExtensions = resolveMaxExtensions(input.maxExtensions ?? null);

    const ownerRepresentativeId = await this.resolveOwner(
      claims,
      perms,
      input.ownerRepresentativeId ?? null,
    );

    if (input.originatingLeadId) {
      const lead = await this.prisma.platformSalesLead.findUnique({
        where: { id: input.originatingLeadId },
        select: { id: true },
      });
      if (!lead) {
        throw new SalesTrialValidationError('originatingLeadId not found.', 'lead_not_found');
      }
    }

    const trialOnlyGrants = (input.trialOnlyGrants ?? []).map((g) => ({
      grantKey: (g.grantKey ?? '').trim(),
      kind: g.kind === 'OVERRIDE' ? ('OVERRIDE' as const) : ('ADD_ON' as const),
      referenceId: g.referenceId ?? null,
      trialOnly: g.trialOnly !== false,
    }));
    if (trialOnlyGrants.some((g) => !g.grantKey)) {
      throw new SalesTrialValidationError(
        'trialOnlyGrants entries require grantKey.',
        'grant_key_required',
      );
    }
    if (new Set(trialOnlyGrants.map((g) => g.grantKey)).size !== trialOnlyGrants.length) {
      throw new SalesTrialValidationError(
        'trialOnlyGrants grantKey values must be unique.',
        'grant_key_duplicate',
      );
    }

    const operation = SALES_TRIAL_OPERATIONS.create;
    const trialId = randomUUID();
    const requestHash = this.durable.fingerprint({
      op: operation,
      organizationName,
      facilityTypeKey: selection.facilityTypeKey,
      specialtyKeys: selection.specialtyKeys,
      moduleKeys: selection.moduleKeys,
      trialPlanVersionId: planVersion.id,
      originatingLeadId: input.originatingLeadId ?? null,
      ownerRepresentativeId,
      platformTenantId: input.platformTenantId ?? null,
      durationDays,
      maxExtensions,
      trialOnlyGrants,
    });

    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesTrial',
      resultResourceId: trialId,
    });
    if (gate.kind === 'replay') return this.getById(claims, perms, gate.result.targetId);

    if (isSalesTrialsFailureInjectionActive('after_idempotency_claim')) {
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw new SalesTrialValidationError('Injected after idempotency claim', 'injected_failure');
    }

    const attribution: TrialAttributionSnapshot = {
      originatingLeadId: input.originatingLeadId ?? null,
      ownerRepresentativeId,
      salesAttributionId: ownerRepresentativeId,
      createdByPlatformUserId: claims.sub,
      frozenAt: this.now().toISOString(),
    };

    try {
      // Stage 1 — durable DRAFT governance record + A01.
      await this.prisma.withPlatformBypass(async (client) => {
        await client.platformSalesTrial.create({
          data: {
            id: trialId,
            status: 'DRAFT',
            organizationName,
            facilityTypeKey: selection.facilityTypeKey,
            selectedSpecialtyKeys: selection.specialtyKeys,
            selectedModuleKeys: selection.moduleKeys,
            trialPlanVersionId: planVersion.id,
            originatingLeadId: input.originatingLeadId ?? null,
            ownerRepresentativeId,
            attributionSnapshotJson: attribution as unknown as Prisma.InputJsonValue,
            trialOnlyGrantsJson: trialOnlyGrants as unknown as Prisma.InputJsonValue,
            maxExtensions,
            createdByPlatformUserId: claims.sub,
          },
        });
        if (isSalesTrialsFailureInjectionActive('after_trial_draft_insert')) {
          throw new SalesTrialValidationError('Injected after trial draft insert', 'injected_failure');
        }
        await this.audit.recordInTransaction(client, {
          action: SALES_TRIAL_AUDIT_ACTIONS.CREATED,
          resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
          resourceId: trialId,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason: input.reason ?? null,
          details: {
            status: 'DRAFT',
            trialPlanVersionId: planVersion.id,
            planCanonicalKey: planVersion.planCanonicalKey,
            durationDays,
            maxExtensions,
            ownerRepresentativeId,
          },
          result: 'success',
          descriptionEn: 'Sales trial created',
          descriptionAr: 'تم إنشاء نسخة تجريبية للمبيعات',
        });
      });

      // Stage 2 — provisioning claim (multi-instance safe status transition).
      const claimed = await this.prisma.withPlatformBypass((client) =>
        client.platformSalesTrial.updateMany({
          where: { id: trialId, status: 'DRAFT' },
          data: { status: 'PENDING_PROVISIONING', rowVersion: { increment: 1 } },
        }),
      );
      if (claimed.count !== 1) {
        throw new SalesTrialConflictError('Trial provisioning already claimed.', 'provisioning_claimed');
      }

      // Stage 3 — Step 17 tenant identity + Step 16 commercial establishment.
      const tenantPair = await this.provisioning.resolveOrCreateTenant({
        claims,
        trialId,
        organizationName,
        platformTenantId: input.platformTenantId ?? null,
        facilityTypeKey: selection.facilityTypeKey,
        specialtyKeys: selection.specialtyKeys,
        moduleKeys: selection.moduleKeys,
      });
      if (isSalesTrialsFailureInjectionActive('after_tenant_provisioning')) {
        throw new SalesTrialValidationError('Injected after tenant provisioning', 'injected_failure');
      }
      const commercialConfigId = await this.provisioning.establishCommercialConfig({
        claims,
        trialId,
        platformTenantId: tenantPair.platformTenantId,
        planVersionId: planVersion.id,
        reason: input.reason?.slice(0, 500) ?? 'Sales trial activation',
      });

      const startsAt = this.now();
      const expiresAt = addDays(startsAt, durationDays);
      await this.provisioning.activateTenantForTrial({
        platformTenantId: tenantPair.platformTenantId,
        tenantId: tenantPair.tenantId,
        expiresAt,
      });

      // Stage 4 — durable ACTIVE transition + idempotency completion + A02.
      await this.prisma.withPlatformBypass(async (client) => {
        const activated = await client.platformSalesTrial.updateMany({
          where: { id: trialId, status: 'PENDING_PROVISIONING' },
          data: {
            status: 'ACTIVE',
            platformTenantId: tenantPair.platformTenantId,
            commercialConfigId,
            startsAt,
            expiresAt,
            rowVersion: { increment: 1 },
          },
        });
        if (activated.count !== 1) {
          throw new SalesTrialConflictError('Trial activation conflict.', 'activation_conflict');
        }
        const correlationId = resolveOperationCorrelationId({});
        const result: TrialActionResult = {
          accepted: true,
          replayed: false,
          action: operation,
          targetId: trialId,
          correlationId,
          result: 'accepted',
        };
        if (isSalesTrialsFailureInjectionActive('before_commit')) {
          throw new SalesTrialValidationError('Injected before commit', 'injected_failure');
        }
        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesTrial',
          resultResourceId: trialId,
          result,
        });
        await this.audit.recordInTransaction(client, {
          action: SALES_TRIAL_AUDIT_ACTIONS.PROVISIONED,
          resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
          resourceId: trialId,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason: input.reason ?? null,
          correlationId,
          details: {
            status: 'ACTIVE',
            platformTenantId: tenantPair.platformTenantId,
            commercialConfigId,
            startsAt: startsAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
            entitlementAuthority: 'step16_snapshot_step18_eer',
          },
          result: 'success',
          descriptionEn: 'Sales trial provisioned and activated',
          descriptionAr: 'تم تهيئة النسخة التجريبية وتنشيطها',
        });
      });
    } catch (err) {
      if (err instanceof TrialIdempotencyEquivalentRaceLostError) {
        return this.getById(claims, perms, err.resultResourceId);
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }

    if (isSalesTrialsFailureInjectionActive('after_commit_before_response')) {
      throw new SalesTrialValidationError(
        'Injected after commit before response',
        'injected_failure',
      );
    }
    return this.getById(claims, perms, trialId);
  }

  private async resolveOwner(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    requested: string | null,
  ): Promise<string | null> {
    if (!hasTrialAllScope(perms)) {
      const actorRep = await this.prisma.platformSalesRepresentative.findUnique({
        where: { platformUserId: claims.sub },
        select: { id: true },
      });
      if (!actorRep) {
        throw new SalesTrialForbiddenError('Actor has no sales representative profile.');
      }
      if (requested && requested !== actorRep.id) {
        throw new SalesTrialForbiddenError(
          'Assigning another owner requires a manager-scope permission.',
        );
      }
      return actorRep.id;
    }
    if (requested) {
      const owner = await this.prisma.platformSalesRepresentative.findUnique({
        where: { id: requested },
        select: { id: true },
      });
      if (!owner) {
        throw new SalesTrialValidationError(
          'ownerRepresentativeId not found.',
          'owner_representative_not_found',
        );
      }
    }
    return requested;
  }

  // ─── update ────────────────────────────────────────────────────────────────

  async update(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      organizationName?: string;
      facilityTypeKey?: string;
      selectedSpecialtyKeys?: string[];
      selectedModuleKeys?: string[];
      maxExtensions?: number;
      ownerRepresentativeId?: string | null;
      expectedRowVersion: number;
      reason?: string;
    },
  ): Promise<SalesTrialDto> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.update);
    const existing = await this.getScopedTrial(claims, perms, id);
    if (TERMINAL_STATUSES.has(existing.status)) {
      throw new SalesTrialConflictError(
        'Terminal Trials cannot be updated.',
        'trial_terminal_immutable',
      );
    }
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
    }
    if (isSalesTrialsFailureInjectionActive('occ_conflict')) {
      throw new SalesTrialConflictError('Injected OCC conflict', 'row_version_conflict');
    }

    const configChangeRequested =
      input.facilityTypeKey !== undefined ||
      input.selectedSpecialtyKeys !== undefined ||
      input.selectedModuleKeys !== undefined;
    if (configChangeRequested && !CONFIG_EDITABLE_STATUSES.has(existing.status)) {
      throw new SalesTrialConflictError(
        'Facility/specialty/module configuration is frozen once the Trial is ACTIVE.',
        'trial_config_frozen',
      );
    }

    let selection: { facilityTypeKey: string; specialtyKeys: string[]; moduleKeys: string[] } | null =
      null;
    if (configChangeRequested) {
      selection = await validateTrialCatalogSelection(this.prisma, {
        facilityTypeKey: input.facilityTypeKey ?? existing.facilityTypeKey,
        specialtyKeys: input.selectedSpecialtyKeys ?? asStringArray(existing.selectedSpecialtyKeys),
        moduleKeys: input.selectedModuleKeys ?? asStringArray(existing.selectedModuleKeys),
      });
    }

    const maxExtensions =
      input.maxExtensions !== undefined ? resolveMaxExtensions(input.maxExtensions) : undefined;
    if (maxExtensions !== undefined && maxExtensions < existing.extensionCount) {
      throw new SalesTrialValidationError(
        'maxExtensions cannot drop below the recorded extensionCount.',
        'max_extensions_below_used',
      );
    }

    const ownerRepresentativeId =
      input.ownerRepresentativeId !== undefined
        ? await this.resolveOwner(claims, perms, input.ownerRepresentativeId)
        : undefined;

    // Audited as field names only: values may be operator-entered free text.
    const changedFields = [
      ...(input.organizationName !== undefined ? ['organizationName'] : []),
      ...(input.facilityTypeKey !== undefined ? ['facilityTypeKey'] : []),
      ...(input.selectedSpecialtyKeys !== undefined ? ['selectedSpecialtyKeys'] : []),
      ...(input.selectedModuleKeys !== undefined ? ['selectedModuleKeys'] : []),
      ...(maxExtensions !== undefined ? ['maxExtensions'] : []),
      ...(ownerRepresentativeId !== undefined ? ['ownerRepresentativeId'] : []),
    ];

    const updated = await this.prisma.withPlatformBypass(async (client) => {
      const result = await client.platformSalesTrial.updateMany({
        where: { id, rowVersion: input.expectedRowVersion },
        data: {
          ...(input.organizationName !== undefined
            ? { organizationName: input.organizationName.trim() }
            : {}),
          ...(selection
            ? {
                facilityTypeKey: selection.facilityTypeKey,
                selectedSpecialtyKeys: selection.specialtyKeys,
                selectedModuleKeys: selection.moduleKeys,
              }
            : {}),
          ...(maxExtensions !== undefined ? { maxExtensions } : {}),
          ...(ownerRepresentativeId !== undefined ? { ownerRepresentativeId } : {}),
          rowVersion: { increment: 1 },
        },
      });
      if (result.count !== 1) {
        throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
      }
      await this.audit.recordInTransaction(client, {
        action: SALES_TRIAL_AUDIT_ACTIONS.UPDATED,
        resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
        resourceId: id,
        actorId: claims.sub,
        actorRoles: this.actorRoles(claims),
        reason: input.reason ?? null,
        details: {
          expectedRowVersion: input.expectedRowVersion,
          statusAtUpdate: existing.status,
          configChanged: configChangeRequested,
          changedFields,
        },
        result: 'success',
        descriptionEn: 'Sales trial updated',
        descriptionAr: 'تم تحديث النسخة التجريبية',
      });
      return client.platformSalesTrial.findUniqueOrThrow({ where: { id } });
    });
    return trialToDto(updated as unknown as TrialRow);
  }

  // ─── extend (E01–E12) ──────────────────────────────────────────────────────

  async extend(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: {
      extensionDays: number;
      reason: string;
      expectedRowVersion: number;
      exceptional?: boolean;
    },
    idempotencyKey: string,
  ): Promise<SalesTrialDto> {
    // E01 — permission required.
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.extend);
    const exceptional = input.exceptional === true;
    // E02 — exceptional extension requires the explicit exceptional key.
    if (exceptional) {
      this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.extendExceptional);
    }
    // E03 — reason is mandatory.
    const reason = (input.reason ?? '').trim();
    if (!reason) {
      throw new SalesTrialValidationError('reason is required for extension.', 'reason_required');
    }
    if (reason.length > MAX_TRIAL_REASON_CHARS) {
      throw new SalesTrialValidationError(
        `reason exceeds ${MAX_TRIAL_REASON_CHARS} characters.`,
        'reason_too_long',
      );
    }
    // E04 — bounded single extension window; never 0 = unlimited.
    assertExtensionDays(input.extensionDays);

    const existing = await this.getScopedTrial(claims, perms, id);

    // E08 — durable idempotency is claimed before the policy/OCC gates so a retry of an
    // accepted extension replays the original result instead of failing on the rowVersion
    // the first attempt already consumed.
    const operation = SALES_TRIAL_OPERATIONS.extend;
    const requestHash = this.durable.fingerprint({
      op: operation,
      id,
      extensionDays: input.extensionDays,
      expectedRowVersion: input.expectedRowVersion,
      exceptional,
      reason,
    });
    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesTrial',
      resultResourceId: id,
    });
    if (gate.kind === 'replay') return this.getById(claims, perms, gate.result.targetId);

    try {
      return await this.applyExtension({
        claims,
        perms,
        id,
        existing,
        reason,
        exceptional,
        extensionDays: input.extensionDays,
        expectedRowVersion: input.expectedRowVersion,
        operation,
        requestHash,
        idempotencyKey,
      });
    } catch (err) {
      if (err instanceof TrialIdempotencyEquivalentRaceLostError) {
        return this.getById(claims, perms, err.resultResourceId);
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }
  }

  private async applyExtension(ctx: {
    claims: JwtClaimsVO;
    perms: ReadonlySet<string>;
    id: string;
    existing: TrialRow;
    reason: string;
    exceptional: boolean;
    extensionDays: number;
    expectedRowVersion: number;
    operation: string;
    requestHash: string;
    idempotencyKey: string;
  }): Promise<SalesTrialDto> {
    const { claims, id, existing, reason, exceptional, operation, requestHash, idempotencyKey } = ctx;
    const input = { extensionDays: ctx.extensionDays, expectedRowVersion: ctx.expectedRowVersion };
    if (isSalesTrialsFailureInjectionActive('extension_policy_validation')) {
      throw new SalesTrialValidationError(
        'Injected extension policy validation failure',
        'injected_failure',
      );
    }
    // E05 — only ACTIVE Trials extend by default; EXPIRED requires exceptional policy.
    if (existing.status === 'EXPIRED') {
      if (!exceptional) {
        throw new SalesTrialConflictError(
          'Expired Trials require an exceptional extension.',
          'trial_expired_extension_denied',
        );
      }
    } else if (existing.status !== 'ACTIVE') {
      throw new SalesTrialConflictError(
        `Trials in status ${existing.status} cannot be extended.`,
        'trial_status_not_extendable',
      );
    }
    if (!existing.expiresAt) {
      throw new SalesTrialConflictError(
        'Trial has no expiry instant to extend.',
        'trial_window_missing',
      );
    }
    // E06 — bounded extension budget; exceptional never means unlimited.
    if (existing.extensionCount >= existing.maxExtensions && !exceptional) {
      throw new SalesTrialConflictError(
        `Extension budget exhausted (${existing.extensionCount}/${existing.maxExtensions}).`,
        'max_extensions_reached',
      );
    }
    if (existing.extensionCount >= existing.maxExtensions && exceptional) {
      throw new SalesTrialConflictError(
        'Exceptional extension cannot exceed the bounded extension budget; raise maxExtensions explicitly first.',
        'max_extensions_reached',
      );
    }
    // E07 — OCC.
    if (existing.rowVersion !== input.expectedRowVersion) {
      throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
    }
    if (isSalesTrialsFailureInjectionActive('occ_conflict')) {
      throw new SalesTrialConflictError('Injected OCC conflict', 'row_version_conflict');
    }

    const previousExpiresAt = existing.expiresAt;
    const newExpiresAt = addDays(previousExpiresAt, input.extensionDays);

    {
      const updated = await this.prisma.withPlatformBypass(async (client) => {
        const result = await client.platformSalesTrial.updateMany({
          where: { id, rowVersion: input.expectedRowVersion },
          data: {
            expiresAt: newExpiresAt,
            extensionCount: { increment: 1 },
            rowVersion: { increment: 1 },
            ...(existing.status === 'EXPIRED'
              ? { status: 'ACTIVE' as never, expiredAt: null }
              : {}),
          },
        });
        if (result.count !== 1) {
          throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
        }
        const correlationId = resolveOperationCorrelationId({});
        // E09 — append-only extension history row.
        await client.platformSalesTrialExtensionHistory.create({
          data: {
            trialId: id,
            previousExpiresAt,
            newExpiresAt,
            extensionDays: input.extensionDays,
            reason,
            exceptional,
            actorPlatformUserId: claims.sub,
            correlationId,
          },
        });
        if (isSalesTrialsFailureInjectionActive('extension_history_write')) {
          throw new SalesTrialValidationError('Injected extension history write', 'injected_failure');
        }
        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesTrial',
          resultResourceId: id,
          result: {
            accepted: true,
            replayed: false,
            action: operation,
            targetId: id,
            correlationId,
            result: 'accepted',
          },
        });
        // E10 — audit exactly once per accepted extension.
        await this.audit.recordInTransaction(client, {
          action: SALES_TRIAL_AUDIT_ACTIONS.EXTENDED,
          resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
          resourceId: id,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason,
          correlationId,
          details: {
            previousExpiresAt: previousExpiresAt.toISOString(),
            newExpiresAt: newExpiresAt.toISOString(),
            extensionDays: input.extensionDays,
            exceptional,
            extensionCountAfter: existing.extensionCount + 1,
            maxExtensions: existing.maxExtensions,
            // E11 — extension never resets U01 usage counters.
            usageCountersReset: false,
          },
          result: 'success',
          descriptionEn: 'Sales trial extended',
          descriptionAr: 'تم تمديد النسخة التجريبية',
        });
        return client.platformSalesTrial.findUniqueOrThrow({ where: { id } });
      });
      // E12 — extension has no parallel entitlement effect; EER re-reads Step 16 identity.
      if (existing.platformTenantId) {
        const pt = await this.prisma.platformTenant.findUnique({
          where: { id: existing.platformTenantId },
          select: { tenantId: true },
        });
        await this.prisma.withPlatformBypass((client) =>
          client.platformTenant.update({
            where: { id: existing.platformTenantId! },
            data: { trialEndsAt: newExpiresAt, rowVersion: { increment: 1 } },
          }),
        );
        this.provisioning.invalidateEer(pt?.tenantId);
      }
      return trialToDto(updated as unknown as TrialRow);
    }
  }

  // ─── cancel (compensating) ─────────────────────────────────────────────────

  async cancel(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
    input: { reason: string; expectedRowVersion: number },
    idempotencyKey: string,
  ): Promise<SalesTrialDto> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.update);
    const reason = (input.reason ?? '').trim();
    if (!reason) {
      throw new SalesTrialValidationError('reason is required to cancel.', 'reason_required');
    }
    const existing = await this.getScopedTrial(claims, perms, id);

    const operation = SALES_TRIAL_OPERATIONS.cancel;
    const requestHash = this.durable.fingerprint({
      op: operation,
      id,
      reason,
      expectedRowVersion: input.expectedRowVersion,
    });
    const gate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
      resultResourceType: 'platformSalesTrial',
      resultResourceId: id,
    });
    // The replay gate runs before the status/OCC checks so a retried cancel replays the
    // original outcome instead of failing on the terminal status it produced itself.
    if (gate.kind === 'replay') return this.getById(claims, perms, gate.result.targetId);

    try {
      if (TERMINAL_STATUSES.has(existing.status)) {
        throw new SalesTrialConflictError(
          `Trials in status ${existing.status} cannot be cancelled.`,
          'trial_status_not_cancellable',
        );
      }
      if (existing.rowVersion !== input.expectedRowVersion) {
        throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
      }
      await this.prisma.withPlatformBypass(async (client) => {
        const result = await client.platformSalesTrial.updateMany({
          where: { id, rowVersion: input.expectedRowVersion },
          data: {
            status: 'CANCELLED',
            cancelledAt: this.now(),
            cancellationReason: reason.slice(0, 1000),
            rowVersion: { increment: 1 },
          },
        });
        if (result.count !== 1) {
          throw new SalesTrialConflictError('Row version conflict.', 'row_version_conflict');
        }
        const correlationId = resolveOperationCorrelationId({});
        await this.durable.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey,
          requestHash,
          resultResourceType: 'platformSalesTrial',
          resultResourceId: id,
          result: {
            accepted: true,
            replayed: false,
            action: operation,
            targetId: id,
            correlationId,
            result: 'accepted',
          },
        });
        await this.audit.recordInTransaction(client, {
          action: SALES_TRIAL_AUDIT_ACTIONS.CANCELLED,
          resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE,
          resourceId: id,
          actorId: claims.sub,
          actorRoles: this.actorRoles(claims),
          reason,
          correlationId,
          details: { statusBefore: existing.status, statusAfter: 'CANCELLED' },
          result: 'success',
          descriptionEn: 'Sales trial cancelled',
          descriptionAr: 'تم إلغاء النسخة التجريبية',
        });
      });
    } catch (err) {
      if (err instanceof TrialIdempotencyEquivalentRaceLostError) {
        return this.getById(claims, perms, err.resultResourceId);
      }
      await this.durable.releasePendingClaim({ actorId: claims.sub, operation, idempotencyKey });
      throw err;
    }

    if (existing.platformTenantId) {
      await this.provisioning.suspendTenantForExpiry({
        platformTenantId: existing.platformTenantId,
        reason: `sales_trial_cancelled:${reason}`.slice(0, 500),
      });
    }
    return this.getById(claims, perms, id);
  }

  // ─── history reads ─────────────────────────────────────────────────────────

  async listExtensions(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesTrialExtensionDto[]> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.view);
    await this.getScopedTrial(claims, perms, id);
    const rows = await this.prisma.platformSalesTrialExtensionHistory.findMany({
      where: { trialId: id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 200,
    });
    return rows.map((r) => ({
      id: r.id,
      trialId: r.trialId,
      previousExpiresAt: r.previousExpiresAt.toISOString(),
      newExpiresAt: r.newExpiresAt.toISOString(),
      extensionDays: r.extensionDays,
      reason: r.reason,
      exceptional: r.exceptional,
      actorPlatformUserId: r.actorPlatformUserId,
      createdAt: r.createdAt.toISOString(),
    }));
  }

  async getConversion(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<SalesTrialConversionDto | null> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.view);
    await this.getScopedTrial(claims, perms, id);
    const row = await this.prisma.platformSalesTrialConversion.findUnique({
      where: { trialId: id },
    });
    if (!row) return null;
    return {
      id: row.id,
      trialId: row.trialId,
      targetPaidPlanVersionId: row.targetPaidPlanVersionId,
      dispositions: (row.dispositionsJson as unknown as TrialGrantDispositionInput[]) ?? [],
      actorPlatformUserId: row.actorPlatformUserId,
      convertedAt: row.convertedAt.toISOString(),
      correlationId: row.correlationId,
      outboxEventId: row.outboxEventId,
      commercialConfigId: row.commercialConfigId,
    };
  }

  /**
   * Consolidated governance history for the detail page: status transitions recorded in the
   * audit trail plus extension and conversion records. Read-only.
   */
  async listHistory(
    claims: JwtClaimsVO,
    perms: ReadonlySet<string>,
    id: string,
  ): Promise<{
    trialId: string;
    audits: Array<{
      id: string;
      action: string;
      actorId: string | null;
      reason: string | null;
      correlationId: string | null;
      createdAt: string;
    }>;
    extensions: SalesTrialExtensionDto[];
    conversion: SalesTrialConversionDto | null;
  }> {
    this.assertPermission(perms, SALES_TRIAL_PERMISSIONS.view);
    await this.getScopedTrial(claims, perms, id);
    const [audits, extensions, conversion] = await Promise.all([
      this.prisma.auditEntry.findMany({
        where: { resourceType: SALES_TRIAL_AUDIT_RESOURCE_TYPE, resourceId: id },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 200,
        select: {
          id: true,
          action: true,
          actorId: true,
          reason: true,
          correlationId: true,
          createdAt: true,
        },
      }),
      this.listExtensions(claims, perms, id),
      this.getConversion(claims, perms, id),
    ]);
    return {
      trialId: id,
      audits: audits.map((a) => ({
        id: a.id,
        action: a.action,
        actorId: a.actorId,
        reason: a.reason,
        correlationId: a.correlationId,
        createdAt: a.createdAt.toISOString(),
      })),
      extensions,
      conversion,
    };
  }

  /** Internal helper shared with expiry/conversion services. */
  async loadTrialOrThrow(id: string): Promise<TrialRow> {
    const row = await this.prisma.platformSalesTrial.findUnique({ where: { id } });
    if (!row) throw new SalesTrialNotFoundError();
    return row as unknown as TrialRow;
  }

  isRuntimeExpired(row: { expiresAt: Date | null }): boolean {
    return isExpiredAt(row.expiresAt, this.now());
  }
}
