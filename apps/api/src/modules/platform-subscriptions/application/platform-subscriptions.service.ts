/**
 * Release 47 Step 16 — Subscription commercial configuration service.
 * Never mutates PlatformSubscription runtime plan/status or calls LicensingEngineService.
 */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import {
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
  isPlatformAuditSentinelTenantId,
} from '../../platform-tenants/platform-tenants.tokens';
import { CommercialCompositionService } from '../../platform-addons/application/commercial-composition.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import {
  PLATFORM_SUBSCRIPTIONS_AUDIT_LOG,
  PLATFORM_SUBSCRIPTIONS_CONFIG,
  PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK,
  RUNTIME_EFFECTIVE,
  type PlatformSubscriptionsConfig,
  type SubscriptionTxFailureHook,
  type SubscriptionTxFailurePoint,
} from '../platform-subscriptions.tokens';
import {
  canTransitionCommercialLifecycle,
  COMMERCIAL_RUNTIME_DISCLAIMER,
  isCommercialConfigMutable,
  isCurrentEligibleLifecycle,
  STATIC_PREVIEW_DISCLAIMER,
  type SubscriptionCommercialLifecycle,
} from '../domain/subscription-commercial-lifecycle';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../domain/subscription-commercial-fingerprint';
import {
  futureEffectiveOverrideSeverity,
  isEditReadinessAction,
  parseSubscriptionReadinessAction,
  type SubscriptionReadinessAction,
} from '../domain/subscription-readiness-action';
import { composeCommercialPreview } from '../../platform-addons/domain/commercial-composition';
import {
  SubscriptionIdempotencyService,
  SubscriptionIdempotencyEquivalentRaceLostError,
  type SubscriptionIdempotencyOperation,
} from './subscription-idempotency.service';
import type { PlatformSubscriptionsAuditLog } from './ports/subscription-audit-log.port';
import { loadPlatformSubscriptionsConfig } from '../config/platform-subscriptions.config';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

// Prisma transaction client; kept loose so AuditEntry append stays Model A
// without fighting Prisma's generated upsert/create argument types.
type AuditTxClient = any;

type RateBucket = 'mutation' | 'highImpact' | 'readHeavy';

const CONFIG_INCLUDE = {
  planVersion: { include: { plan: true } },
  addOnAssignments: {
    include: { addOnVersion: { include: { applicability: true, addOn: true } } },
  },
  overrideAssignments: { include: { override: true } },
  snapshots: true,
} as const;

@Injectable()
export class PlatformSubscriptionsService {
  private readonly rateHits = new Map<string, number[]>();
  private readonly config: PlatformSubscriptionsConfig;

  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: PlatformAuthorizationService,
    @Inject(PLATFORM_SUBSCRIPTIONS_AUDIT_LOG)
    private readonly audit: PlatformSubscriptionsAuditLog,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly refreshRepo: PlatformRefreshTokenRepository,
    private readonly assurance: PlatformAssuranceService,
    private readonly idempotency: SubscriptionIdempotencyService,
    private readonly composition: CommercialCompositionService,
    @Optional() @Inject(PLATFORM_SUBSCRIPTIONS_CONFIG) config?: PlatformSubscriptionsConfig,
    @Optional()
    @Inject(PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK)
    private readonly txFailureHook?: SubscriptionTxFailureHook,
    @Optional()
    private readonly effectiveEntitlements?: EffectiveEntitlementRuntimeService,
  ) {
    this.config = config ?? loadPlatformSubscriptionsConfig();
  }

  private invalidateEffectiveRuntimeCache(platformTenantId: string): void {
    void this.prisma
      .withPlatformBypass((client) =>
        client.platformTenant.findUnique({
          where: { id: platformTenantId },
          select: { tenantId: true },
        }),
      )
      .then((pt) => {
        if (pt?.tenantId) this.effectiveEntitlements?.invalidateTenant(pt.tenantId);
      })
      .catch(() => undefined);
  }

  private async maybeFail(point: SubscriptionTxFailurePoint): Promise<void> {
    if (this.txFailureHook) await this.txFailureHook(point);
  }

  private require(permissions: Set<string>, key: string): void {
    if (!permissions.has(key)) {
      throw new ForbiddenException(`Missing ${key} permission.`);
    }
  }

  private async permissionsFor(claims: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authorization.resolveEffectivePermissions(claims.sub));
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    const sessionId = claims.sessionId;
    if (!sessionId) {
      throw new ForbiddenException('Fresh step-up required.');
    }
    const session = await this.refreshRepo.findBySessionId(sessionId);
    if (!session) {
      throw new ForbiddenException('Fresh step-up required.');
    }
    await this.assurance.requireStepUp(session);
  }

  private enforceRateLimit(actorId: string, bucket: RateBucket): void {
    const limit =
      bucket === 'mutation'
        ? this.config.mutationRateLimitPerMinute
        : bucket === 'highImpact'
          ? this.config.highImpactRateLimitPerMinute
          : this.config.readHeavyRateLimitPerMinute;
    const key = `${bucket}:${actorId}`;
    const now = Date.now();
    const windowStart = now - 60_000;
    const hits = (this.rateHits.get(key) ?? []).filter((t) => t > windowStart);
    if (hits.length >= limit) {
      throw new HttpException('Subscription rate limit exceeded.', HttpStatus.TOO_MANY_REQUESTS);
    }
    hits.push(now);
    this.rateHits.set(key, hits);
  }

  private toDto(row: any) {
    return {
      id: row.id,
      platformTenantId: row.platformTenantId,
      platformSubscriptionId: row.platformSubscriptionId,
      lifecycle: row.lifecycle,
      isCurrent: row.isCurrent,
      rowVersion: row.rowVersion,
      planVersionId: row.planVersionId,
      planCanonicalKey: row.planVersion?.plan?.canonicalKey ?? null,
      planVersionNumber: row.planVersion?.versionNumber ?? null,
      planPublicationFingerprint: row.planVersion?.publicationFingerprint ?? null,
      addonVersionIds: (row.addOnAssignments ?? []).map((a: any) => a.addOnVersionId).sort(),
      overrideIds: (row.overrideAssignments ?? []).map((a: any) => a.overrideId).sort(),
      addonCount: (row.addOnAssignments ?? []).length,
      overrideCount: (row.overrideAssignments ?? []).length,
      commercialStart: row.commercialStart?.toISOString?.() ?? row.commercialStart ?? null,
      commercialEnd: row.commercialEnd?.toISOString?.() ?? row.commercialEnd ?? null,
      scheduledActivationAt:
        row.scheduledActivationAt?.toISOString?.() ?? row.scheduledActivationAt ?? null,
      cancelledAt: row.cancelledAt?.toISOString?.() ?? row.cancelledAt ?? null,
      cancellationEffectiveAt:
        row.cancellationEffectiveAt?.toISOString?.() ?? row.cancellationEffectiveAt ?? null,
      commercialFingerprint: row.commercialFingerprint,
      fingerprintSchemaVersion: row.fingerprintSchemaVersion,
      predecessorId: row.predecessorId,
      reasonCode: row.reasonCode,
      hasSnapshot: Array.isArray(row.snapshots) ? row.snapshots.length > 0 : !!row.snapshots,
      createdAt: row.createdAt?.toISOString?.() ?? row.createdAt,
      updatedAt: row.updatedAt?.toISOString?.() ?? row.updatedAt,
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: COMMERCIAL_RUNTIME_DISCLAIMER,
    };
  }

  private async loadConfig(id: string) {
    const row = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialConfig.findUnique({
        where: { id },
        include: CONFIG_INCLUDE,
      }),
    );
    if (!row) throw new NotFoundException('Commercial subscription configuration not found.');
    return row;
  }

  /**
   * Step 21 A08/A10 — durable success AuditEntry append (Model A).
   * Must be called with the same transaction client as the business
   * mutation it documents; throws on failure so the whole transaction
   * rolls back rather than silently losing the audit trail.
   */
  private async auditMutation(
    client: AuditTxClient,
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    const correlationId = resolveOperationCorrelationId({ explicit: null });
    await this.audit.recordInTransaction(client, {
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action,
      resourceId,
      actorId: claims.sub,
      actorRoles: ['platform'],
      locale: 'en-US',
      descriptionEn: action,
      descriptionAr: action,
      correlationId,
      details: { ...details, runtimeEffective: 'false' },
    });
  }

  private async beginIdempotent(
    claims: JwtClaimsVO,
    operation: SubscriptionIdempotencyOperation,
    payload: unknown,
    idempotencyKey?: string,
  ) {
    if (!idempotencyKey) return null;
    const requestHash = this.idempotency.fingerprint(payload);
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return { kind: 'replay' as const, id: gate.resultResourceId };
    }
    return { kind: 'proceed' as const, idempotencyKey: gate.idempotencyKey, requestHash };
  }

  async list(
    claims: JwtClaimsVO,
    query: {
      lifecycle?: string;
      platformTenantId?: string;
      page?: string;
      pageSize?: string;
    },
  ) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const page = Math.max(1, Number.parseInt(query.page ?? '1', 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(query.pageSize ?? '50', 10) || 50));
    const where: Record<string, unknown> = {};
    if (query.lifecycle) where.lifecycle = query.lifecycle;
    if (query.platformTenantId) where.platformTenantId = query.platformTenantId;
    const [total, items] = await this.prisma.withPlatformBypass(async (client) => {
      const totalCount = await client.platformSubscriptionCommercialConfig.count({ where });
      const rows = await client.platformSubscriptionCommercialConfig.findMany({
        where,
        include: CONFIG_INCLUDE,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      return [totalCount, rows];
    });
    return {
      items: items.map((r) => this.toDto(r)),
      page,
      pageSize,
      total,
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: COMMERCIAL_RUNTIME_DISCLAIMER,
    };
  }

  async get(claims: JwtClaimsVO, id: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    return this.toDto(await this.loadConfig(id));
  }

  async create(
    claims: JwtClaimsVO,
    body: {
      platformTenantId: string;
      platformSubscriptionId?: string | null;
      commercialStart?: string | null;
      commercialEnd?: string | null;
      reasonCode?: string | null;
    },
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, 'subscription.assign');
      this.enforceRateLimit(claims.sub, 'mutation');
    }

    const claim = await this.beginIdempotent(claims, 'subscription.create', body, idempotencyKey);
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const tenant = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: body.platformTenantId },
        include: { tenant: true },
      }),
    );
    if (!tenant) throw new NotFoundException('Platform tenant not found.');
    if (isPlatformAuditSentinelTenantId(tenant.tenantId)) {
      throw new BadRequestException('Audit sentinel tenant is not eligible.');
    }
    if (tenant.status === 'ARCHIVED') {
      throw new BadRequestException('Archived tenants cannot receive commercial configuration.');
    }
    if (tenant.status === 'SUSPENDED') {
      throw new BadRequestException({
        message: 'Tenant lifecycle is ineligible for commercial mutation.',
        code: 'tenant_lifecycle_ineligible',
        action: 'edit',
        ready: false,
      });
    }
    await this.assertCorrelationForWrite(
      tenant.id,
      body.platformSubscriptionId ?? null,
      'create',
    );

    // Option A — reject direct second create while a current configuration exists.
    // Successors must use supersede or renew (never expose raw unique-index errors).
    const existingCurrent = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialConfig.findFirst({
        where: { platformTenantId: tenant.id, isCurrent: true },
        select: { id: true },
      }),
    );
    if (existingCurrent) {
      throw new ConflictException({
        message:
          'Tenant already has a current commercial subscription configuration. Use supersede or renew to create a successor.',
        code: 'current_configuration_already_exists',
      });
    }

    const commercialStart = body.commercialStart ? new Date(body.commercialStart) : null;
    const commercialEnd = body.commercialEnd ? new Date(body.commercialEnd) : null;
    this.assertDateOrder(commercialStart, commercialEnd);

    const id = randomUUID();
    try {
      await this.prisma.withPlatformBypass(async (client) => {
        await client.platformSubscriptionCommercialConfig.create({
          data: {
            id,
            platformTenantId: tenant.id,
            platformSubscriptionId: body.platformSubscriptionId ?? null,
            lifecycle: 'DRAFT',
            isCurrent: true,
            commercialStart,
            commercialEnd,
            reasonCode: body.reasonCode ?? null,
            createdByPlatformUserId: claims.sub,
          },
        });
        await this.maybeFail('after_create_parent_insert');
        await client.platformSubscriptionCommercialChange.create({
          data: {
            id: randomUUID(),
            configId: id,
            action: 'subscription.created',
            actorId: claims.sub,
            beforeLifecycle: null,
            afterLifecycle: 'DRAFT',
            metadataJson: { result: 'success' },
          },
        });
        if (claim?.kind === 'proceed') {
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'subscription.create',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'subscriptionCommercialConfig',
            resultResourceId: id,
          });
        }
        await this.maybeFail('before_create_commit');
        await this.maybeFail('before_transaction_commit');
        await this.auditMutation(client, claims, 'platform_subscription_commercial.created', id, {
          result: 'success',
          lifecycleAfter: 'DRAFT',
        });
      });
    } catch (err) {
      if (err instanceof ConflictException) throw err;
      if (err instanceof SubscriptionIdempotencyEquivalentRaceLostError) {
        return this.toDto(await this.loadConfig(err.resultResourceId));
      }
      const msg = String((err as Error)?.message ?? err);
      if (msg.includes('platform_subscription_commercial_one_current_per_tenant')) {
        throw new ConflictException({
          message:
            'Tenant already has a current commercial subscription configuration. Use supersede or renew to create a successor.',
          code: 'current_configuration_already_exists',
        });
      }
      throw err;
    }

    return this.toDto(await this.loadConfig(id));
  }

  async update(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reasonCode?: string | null },
    idempotencyKey?: string,
  ) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.assign');
    this.enforceRateLimit(claims.sub, 'mutation');
    const claim = await this.beginIdempotent(
      claims,
      'subscription.update',
      { id, ...body },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    if (!isCommercialConfigMutable(existing.lifecycle as SubscriptionCommercialLifecycle)) {
      throw new ConflictException('Only Draft commercial configurations are editable.');
    }
    if (existing.rowVersion !== body.expectedRowVersion) {
      throw new ConflictException('Stale rowVersion.');
    }
    await this.assertTenantEligibleForCommercialMutation(existing.platformTenantId, 'edit');

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSubscriptionCommercialConfig.updateMany({
        where: { id, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          reasonCode: body.reasonCode === undefined ? undefined : body.reasonCode,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Stale rowVersion.');
      await this.maybeFail('after_update_metadata');
      await this.maybeFail('after_update_row_version');
      if (claim?.kind === 'proceed') {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'subscription.update',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: id,
        });
      }
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(client, claims, 'platform_subscription_commercial.updated', id, {
        result: 'success',
        expectedVersion: String(body.expectedRowVersion),
        resultingVersion: String(body.expectedRowVersion + 1),
      });
    });

    return this.toDto(await this.loadConfig(id));
  }

  async assignPlanVersion(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; planVersionId: string },
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, 'subscription.assign');
      this.enforceRateLimit(claims.sub, 'mutation');
    }
    const claim = await this.beginIdempotent(
      claims,
      'subscription.assignPlanVersion',
      { id, ...body },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    this.assertDraftMutable(existing, body.expectedRowVersion);
    await this.assertTenantEligibleForCommercialMutation(existing.platformTenantId, 'assign_plan');
    await this.assertEligiblePlanVersion(body.planVersionId);

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSubscriptionCommercialConfig.updateMany({
        where: { id, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: { planVersionId: body.planVersionId, rowVersion: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException('Stale rowVersion.');
      await this.maybeFail('after_plan_assignment_write');
      await this.maybeFail('after_plan_row_version');
      await client.platformSubscriptionCommercialChange.create({
        data: {
          id: randomUUID(),
          configId: id,
          action: 'plan_version.assigned',
          actorId: claims.sub,
          beforeLifecycle: 'DRAFT',
          afterLifecycle: 'DRAFT',
          metadataJson: { result: 'success' },
        },
      });
      if (claim?.kind === 'proceed') {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'subscription.assignPlanVersion',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: id,
        });
      }
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(
        client,
        claims,
        'platform_subscription_commercial.plan_version_assigned',
        id,
        {
          result: 'success',
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(body.expectedRowVersion + 1),
        },
      );
    });

    return this.toDto(await this.loadConfig(id));
  }

  async replaceAddOns(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; addOnVersionIds: string[] },
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, 'subscription.assign');
      this.enforceRateLimit(claims.sub, 'mutation');
    }
    const rawIds = body.addOnVersionIds ?? [];
    const ids = [...new Set(rawIds)];
    if (ids.length !== rawIds.length) {
      throw new BadRequestException({
        message: 'Duplicate Add-on Version IDs are not allowed.',
        code: 'addon_duplicate',
      });
    }
    const claim = await this.beginIdempotent(
      claims,
      'subscription.replaceAddOns',
      { id, expectedRowVersion: body.expectedRowVersion, addOnVersionIds: ids },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    this.assertDraftMutable(existing, body.expectedRowVersion);
    await this.assertTenantEligibleForCommercialMutation(existing.platformTenantId, 'assign_addons');
    if (!existing.planVersionId) {
      throw new BadRequestException('Assign a Plan Version before Add-on Versions.');
    }
    const planKey = existing.planVersion!.plan.canonicalKey;
    await this.assertEligibleAddonVersions(ids, planKey, existing.planVersionId);

    try {
      await this.prisma.withPlatformBypass(async (client) => {
        // Deterministic claim before mutation: concurrent exact duplicates serialize on the
        // unique idempotency index; loser RaceLost → replay (no second business/audit success).
        if (claim?.kind === 'proceed') {
          await this.idempotency.claimInTransaction(client, {
            actorId: claims.sub,
            operation: 'subscription.replaceAddOns',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'subscriptionCommercialConfig',
            resultResourceId: id,
          });
        }
        const locked = await client.$queryRawUnsafe<Array<{ id: string }>>(
          `SELECT id FROM platform_subscription_commercial_configs
           WHERE id = $1::uuid AND "rowVersion" = $2 AND lifecycle = 'DRAFT'
           FOR UPDATE`,
          id,
          body.expectedRowVersion,
        );
        if (locked.length !== 1) throw new ConflictException('Stale rowVersion.');
        await client.platformSubscriptionAddOnAssignment.deleteMany({ where: { configId: id } });
        await this.maybeFail('after_addon_delete');
        if (ids.length) {
          await client.platformSubscriptionAddOnAssignment.create({
            data: { id: randomUUID(), configId: id, addOnVersionId: ids[0]! },
          });
          await this.maybeFail('after_addon_first_insert');
          if (ids.length > 1) {
            await client.platformSubscriptionAddOnAssignment.createMany({
              data: ids.slice(1).map((addOnVersionId) => ({
                id: randomUUID(),
                configId: id,
                addOnVersionId,
              })),
            });
          }
          await this.maybeFail('after_addon_partial_insert');
        }
        await this.maybeFail('after_addon_all_insert_before_row_version');
        await client.platformSubscriptionCommercialConfig.update({
          where: { id },
          data: { rowVersion: { increment: 1 } },
        });
        await this.maybeFail('after_addon_row_version');
        await this.maybeFail('after_addon_audit_staging');
        if (claim?.kind === 'proceed') {
          await this.maybeFail('before_addon_idempotency');
          await this.maybeFail('before_idempotency_complete');
          await this.idempotency.completeInTransaction(client, {
            actorId: claims.sub,
            operation: 'subscription.replaceAddOns',
            idempotencyKey: claim.idempotencyKey,
            requestHash: claim.requestHash,
            resultResourceType: 'subscriptionCommercialConfig',
            resultResourceId: id,
          });
        }
        await this.maybeFail('before_transaction_commit');
        await this.auditMutation(client, claims, 'platform_subscription_commercial.addons_replaced', id, {
          result: 'success',
          addonCount: String(ids.length),
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(body.expectedRowVersion + 1),
        });
        await this.maybeFail('after_addon_success_audit');
      });
    } catch (err) {
      if (
        err instanceof SubscriptionIdempotencyEquivalentRaceLostError ||
        (err as { name?: string })?.name === 'SubscriptionIdempotencyEquivalentRaceLostError'
      ) {
        const lost = err as SubscriptionIdempotencyEquivalentRaceLostError;
        return this.toDto(await this.loadConfig(lost.resultResourceId));
      }
      throw err;
    }

    return this.toDto(await this.loadConfig(id));
  }

  async replaceOverrides(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; overrideIds: string[] },
    idempotencyKey?: string,
  ) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.assign');
    this.enforceRateLimit(claims.sub, 'mutation');
    const rawIds = body.overrideIds ?? [];
    const ids = [...new Set(rawIds)];
    if (ids.length !== rawIds.length) {
      throw new BadRequestException({
        message: 'Duplicate Override IDs are not allowed.',
        code: 'override_duplicate',
      });
    }
    const claim = await this.beginIdempotent(
      claims,
      'subscription.replaceOverrides',
      { id, expectedRowVersion: body.expectedRowVersion, overrideIds: ids },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    this.assertDraftMutable(existing, body.expectedRowVersion);
    await this.assertTenantEligibleForCommercialMutation(existing.platformTenantId, 'assign_overrides');
    await this.assertEligibleOverrides(ids, existing);

    await this.prisma.withPlatformBypass(async (client) => {
      const locked = await client.$queryRawUnsafe<Array<{ id: string }>>(
        `SELECT id FROM platform_subscription_commercial_configs
         WHERE id = $1::uuid AND "rowVersion" = $2 AND lifecycle = 'DRAFT'
         FOR UPDATE`,
        id,
        body.expectedRowVersion,
      );
      if (locked.length !== 1) throw new ConflictException('Stale rowVersion.');
      await client.platformSubscriptionOverrideAssignment.deleteMany({ where: { configId: id } });
      await this.maybeFail('after_override_delete');
      if (ids.length) {
        await client.platformSubscriptionOverrideAssignment.create({
          data: { id: randomUUID(), configId: id, overrideId: ids[0]! },
        });
        await this.maybeFail('after_override_first_insert');
        if (ids.length > 1) {
          await client.platformSubscriptionOverrideAssignment.createMany({
            data: ids.slice(1).map((overrideId) => ({
              id: randomUUID(),
              configId: id,
              overrideId,
            })),
          });
        }
        await this.maybeFail('after_override_partial_insert');
      }
      await this.maybeFail('after_override_all_insert_before_row_version');
      await client.platformSubscriptionCommercialConfig.update({
        where: { id },
        data: { rowVersion: { increment: 1 } },
      });
      await this.maybeFail('after_override_row_version');
      await this.maybeFail('after_override_audit_staging');
      if (claim?.kind === 'proceed') {
        await this.maybeFail('before_override_idempotency');
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'subscription.replaceOverrides',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: id,
        });
      }
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(
        client,
        claims,
        'platform_subscription_commercial.overrides_replaced',
        id,
        {
          result: 'success',
          overrideCount: String(ids.length),
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(body.expectedRowVersion + 1),
        },
      );
    });

    return this.toDto(await this.loadConfig(id));
  }

  async updateDates(
    claims: JwtClaimsVO,
    id: string,
    body: {
      expectedRowVersion: number;
      commercialStart?: string | null;
      commercialEnd?: string | null;
      scheduledActivationAt?: string | null;
    },
    idempotencyKey?: string,
  ) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.assign');
    this.enforceRateLimit(claims.sub, 'mutation');
    const claim = await this.beginIdempotent(
      claims,
      'subscription.updateDates',
      { id, ...body },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    this.assertDraftMutable(existing, body.expectedRowVersion);
    await this.assertTenantEligibleForCommercialMutation(existing.platformTenantId, 'update_dates');
    const commercialStart =
      body.commercialStart === undefined
        ? existing.commercialStart
        : body.commercialStart
          ? new Date(body.commercialStart)
          : null;
    const commercialEnd =
      body.commercialEnd === undefined
        ? existing.commercialEnd
        : body.commercialEnd
          ? new Date(body.commercialEnd)
          : null;
    const scheduledActivationAt =
      body.scheduledActivationAt === undefined
        ? existing.scheduledActivationAt
        : body.scheduledActivationAt
          ? new Date(body.scheduledActivationAt)
          : null;
    this.assertDateOrder(commercialStart, commercialEnd);

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSubscriptionCommercialConfig.updateMany({
        where: { id, rowVersion: body.expectedRowVersion, lifecycle: 'DRAFT' },
        data: {
          commercialStart,
          commercialEnd,
          scheduledActivationAt,
          rowVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new ConflictException('Stale rowVersion.');
      await this.maybeFail('after_dates_update');
      await this.maybeFail('after_dates_row_version');
      if (claim?.kind === 'proceed') {
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'subscription.updateDates',
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: id,
        });
      }
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(client, claims, 'platform_subscription_commercial.dates_updated', id, {
        result: 'success',
        dateClassification: 'commercial_window',
        expectedVersion: String(body.expectedRowVersion),
        resultingVersion: String(body.expectedRowVersion + 1),
      });
    });

    return this.toDto(await this.loadConfig(id));
  }

  async readiness(claims: JwtClaimsVO, id: string, actionRaw?: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const row = await this.loadConfig(id);
    const action = parseSubscriptionReadinessAction(actionRaw);
    return this.computeReadiness(row, action);
  }

  async preview(claims: JwtClaimsVO, id: string, opts?: { provisioningAuthority?: boolean }) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, 'subscription.view');
      this.enforceRateLimit(claims.sub, 'readHeavy');
    }
    const row = await this.loadConfig(id);
    const readiness = await this.computeReadiness(row, 'preview');
    if (!row.planVersionId) {
      return {
        readiness,
        composition: null,
        runtimeEffective: RUNTIME_EFFECTIVE,
        disclaimer: STATIC_PREVIEW_DISCLAIMER,
      };
    }
    const composition = await this.composition.preview(claims, {
      planVersionId: row.planVersionId,
      addonVersionIds: row.addOnAssignments.map((a) => a.addOnVersionId),
      overrideIds: row.overrideAssignments.map((a) => a.overrideId),
    });
    return {
      readiness,
      composition,
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: STATIC_PREVIEW_DISCLAIMER,
    };
  }

  async history(claims: JwtClaimsVO, id: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    await this.loadConfig(id);
    const changes = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscriptionCommercialChange.findMany({
        where: { configId: id },
        orderBy: { createdAt: 'asc' },
      }),
    );
    return {
      items: changes.map((c) => ({
        id: c.id,
        action: c.action,
        beforeLifecycle: c.beforeLifecycle,
        afterLifecycle: c.afterLifecycle,
        createdAt: c.createdAt.toISOString(),
      })),
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: COMMERCIAL_RUNTIME_DISCLAIMER,
    };
  }

  /**
   * Step 17 — bounded Platform runtime inspection (read-only).
   * Permission: subscription.view (Option A freeze).
   * Permits: commercial config context + bounded runtime source/status + bounded explanation.
   * Does not permit: snapshot JSON export, cache payload, mutation, invalidation, assignment, lifecycle.
   * Never returns raw snapshot JSON, PHI, tokens, approval identities, or Override notes.
   */
  async inspectRuntime(claims: JwtClaimsVO, id: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const row = await this.loadConfig(id);
    const platformTenant = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: row.platformTenantId },
        select: { tenantId: true },
      }),
    );
    if (!platformTenant?.tenantId || !this.effectiveEntitlements) {
      return {
        source: 'LEGACY' as const,
        code: 'legacy_runtime',
        lifecycle: row.lifecycle,
        moduleCount: 0,
        featureCount: 0,
        specialtyCount: 0,
        limitsSummary: [],
        cacheStatus: 'BYPASS',
        evaluatedAt: new Date().toISOString(),
        blockers: [{ code: 'runtime_service_unavailable' }],
      };
    }
    const bundle = await this.effectiveEntitlements.resolveEffectiveEntitlements(
      platformTenant.tenantId,
    );
    const blockers: Array<{ code: string }> = [];
    if (bundle.code !== 'snapshot_resolved' && bundle.source === 'SNAPSHOT') {
      blockers.push({ code: bundle.code });
    }
    if (!row.isCurrent) {
      blockers.push({ code: 'configuration_not_current' });
    } else if (row.lifecycle === 'DRAFT' || row.lifecycle === 'SCHEDULED') {
      blockers.push({ code: 'configuration_not_runtime_effective' });
    }
    const thisConfigIsRuntimeInput =
      bundle.source === 'SNAPSHOT' && bundle.configId === row.id;
    return {
      source: bundle.source,
      code:
        bundle.source === 'LEGACY'
          ? 'legacy_runtime'
          : thisConfigIsRuntimeInput
            ? bundle.code === 'snapshot_resolved'
              ? 'snapshot_resolved'
              : bundle.code
            : bundle.code === 'snapshot_resolved'
              ? 'snapshot_resolved_other_current'
              : bundle.code,
      provenance: bundle.provenance,
      lifecycle: row.lifecycle,
      snapshotId: thisConfigIsRuntimeInput
        ? bundle.snapshotId
        : row.snapshots[0]?.id,
      fingerprintSchema: thisConfigIsRuntimeInput
        ? bundle.fingerprintSchema
        : row.snapshots[0]?.fingerprintSchemaVersion,
      fingerprint: thisConfigIsRuntimeInput
        ? bundle.fingerprint
        : row.snapshots[0]?.fingerprint,
      planCanonicalKey: thisConfigIsRuntimeInput
        ? bundle.planCanonicalKey
        : row.planVersion?.plan?.canonicalKey,
      planVersionNumber: thisConfigIsRuntimeInput
        ? bundle.planVersionNumber
        : row.planVersion?.versionNumber,
      addonCount: row.addOnAssignments.length,
      overrideCount: row.overrideAssignments.length,
      moduleCount: thisConfigIsRuntimeInput ? bundle.modules.length : 0,
      featureCount: thisConfigIsRuntimeInput ? bundle.features.length : 0,
      specialtyCount: thisConfigIsRuntimeInput ? bundle.specialties.length : 0,
      limitsSummary: thisConfigIsRuntimeInput
        ? Object.entries(bundle.limits)
            .map(([key, limit]) => ({ key, state: limit.state }))
            .sort((a, b) => a.key.localeCompare(b.key))
        : [],
      cacheStatus: 'PROCESS_LOCAL',
      evaluatedAt: bundle.evaluatedAt,
      blockers,
    };
  }

  async explainRuntime(claims: JwtClaimsVO, id: string, key: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const row = await this.loadConfig(id);
    const platformTenant = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({
        where: { id: row.platformTenantId },
        select: { tenantId: true },
      }),
    );
    if (!platformTenant?.tenantId || !this.effectiveEntitlements) {
      return {
        key,
        allowed: false,
        code: 'runtime_service_unavailable',
        source: 'LEGACY' as const,
        evaluatedAt: new Date().toISOString(),
        attribution: [],
      };
    }
    return this.effectiveEntitlements.explainEntitlement(platformTenant.tenantId, key);
  }

  async compare(claims: JwtClaimsVO, id: string, otherId: string) {
    const permissions = await this.permissionsFor(claims);
    this.require(permissions, 'subscription.view');
    this.enforceRateLimit(claims.sub, 'readHeavy');
    const left = this.toDto(await this.loadConfig(id));
    const right = this.toDto(await this.loadConfig(otherId));
    return {
      left,
      right,
      differences: {
        planVersionChanged: left.planVersionId !== right.planVersionId,
        addonsChanged: JSON.stringify(left.addonVersionIds) !== JSON.stringify(right.addonVersionIds),
        overridesChanged: JSON.stringify(left.overrideIds) !== JSON.stringify(right.overrideIds),
        datesChanged:
          left.commercialStart !== right.commercialStart || left.commercialEnd !== right.commercialEnd,
        lifecycleChanged: left.lifecycle !== right.lifecycle,
      },
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: COMMERCIAL_RUNTIME_DISCLAIMER,
    };
  }

  async schedule(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; scheduledActivationAt: string; reason: string },
    idempotencyKey?: string,
  ) {
    return this.transitionLifecycle(claims, id, 'SCHEDULED', body, 'subscription.schedule', {
      scheduledActivationAt: new Date(body.scheduledActivationAt),
    }, idempotencyKey);
  }

  async activate(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    return this.transitionLifecycle(
      claims,
      id,
      'ACTIVE_COMMERCIAL',
      body,
      'subscription.activate',
      {},
      idempotencyKey,
      'subscription.migrate',
      opts,
    );
  }

  async suspend(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
  ) {
    return this.transitionLifecycle(claims, id, 'SUSPENDED', body, 'subscription.suspend', {}, idempotencyKey, 'subscription.suspend');
  }

  async resume(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
  ) {
    return this.transitionLifecycle(claims, id, 'ACTIVE_COMMERCIAL', body, 'subscription.resume', {}, idempotencyKey, 'subscription.suspend');
  }

  async cancel(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string; cancellationEffectiveAt?: string },
    idempotencyKey?: string,
  ) {
    return this.transitionLifecycle(
      claims,
      id,
      'CANCELLED',
      body,
      'subscription.cancel',
      {
        cancelledAt: new Date(),
        cancellationEffectiveAt: body.cancellationEffectiveAt
          ? new Date(body.cancellationEffectiveAt)
          : new Date(),
        isCurrent: false,
      },
      idempotencyKey,
      'subscription.cancel',
    );
  }

  async supersede(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    return this.supersedeInternal(claims, id, body, 'subscription.supersede', idempotencyKey, opts);
  }

  /**
   * Renew is a specialized successor command for the next commercial term (no billing).
   * Distinct from supersede: requires renewalEffectiveAt, stricter predecessor lifecycles,
   * exact assignment copy, and renewal provenance (reasonCode RENEW + commercialStart).
   */
  async renew(
    claims: JwtClaimsVO,
    id: string,
    body: { expectedRowVersion: number; reason: string; renewalEffectiveAt: string },
    idempotencyKey?: string,
  ) {
    if (!body.renewalEffectiveAt?.trim()) {
      throw new BadRequestException({
        message: 'renewalEffectiveAt is required for renew.',
        code: 'renewal_effective_date_required',
      });
    }
    return this.supersedeInternal(claims, id, body, 'subscription.renew', idempotencyKey);
  }

  private async supersedeInternal(
    claims: JwtClaimsVO,
    id: string,
    body: {
      expectedRowVersion: number;
      reason: string;
      renewalEffectiveAt?: string;
    },
    operation: 'subscription.supersede' | 'subscription.renew',
    idempotencyKey?: string,
    opts?: { provisioningAuthority?: boolean },
  ) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, 'subscription.migrate');
      await this.requireFreshStepUp(claims);
      this.enforceRateLimit(claims.sub, 'highImpact');
    }
    if (!body.reason?.trim()) {
      throw new BadRequestException({
        message: `${operation === 'subscription.renew' ? 'Renewal' : 'Supersede'} reason is required.`,
        code: 'reason_required',
      });
    }
    const claim = await this.beginIdempotent(
      claims,
      operation,
      { id, ...body },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    if (existing.rowVersion !== body.expectedRowVersion) {
      throw new ConflictException('Stale rowVersion.');
    }
    await this.assertTenantEligibleForCommercialMutation(
      existing.platformTenantId,
      operation === 'subscription.renew' ? 'renew' : 'supersede',
    );
    if (
      !canTransitionCommercialLifecycle(
        existing.lifecycle as SubscriptionCommercialLifecycle,
        'SUPERSEDED',
      )
    ) {
      throw new ConflictException({
        message: 'Invalid lifecycle transition.',
        code: 'lifecycle_transition_invalid',
      });
    }

    let successorCommercialStart = existing.commercialStart;
    let successorCommercialEnd = existing.commercialEnd;
    if (operation === 'subscription.renew') {
      const renewAllowed: SubscriptionCommercialLifecycle[] = [
        'ACTIVE_COMMERCIAL',
        'SUSPENDED',
      ];
      if (!renewAllowed.includes(existing.lifecycle as SubscriptionCommercialLifecycle)) {
        throw new ConflictException({
          message: 'Renew is only allowed from ACTIVE_COMMERCIAL or SUSPENDED.',
          code: 'renew_lifecycle_invalid',
        });
      }
      const renewalEffectiveAt = new Date(body.renewalEffectiveAt!);
      if (Number.isNaN(renewalEffectiveAt.getTime())) {
        throw new BadRequestException({
          message: 'renewalEffectiveAt must be a valid ISO-8601 UTC timestamp.',
          code: 'renewal_effective_date_invalid',
        });
      }
      if (existing.commercialEnd && renewalEffectiveAt < existing.commercialEnd) {
        throw new BadRequestException({
          message: 'renewalEffectiveAt overlaps the predecessor commercial window.',
          code: 'renewal_overlap',
        });
      }
      if (
        !existing.commercialEnd &&
        existing.commercialStart &&
        renewalEffectiveAt < existing.commercialStart
      ) {
        throw new BadRequestException({
          message: 'renewalEffectiveAt must not precede the predecessor commercial start.',
          code: 'renewal_continuity_invalid',
        });
      }
      successorCommercialStart = renewalEffectiveAt;
      successorCommercialEnd = null;
    }

    if (operation === 'subscription.renew') {
      await this.maybeFail('after_renew_validation');
      await this.maybeFail('after_renew_date_validation');
    }

    const successorId = randomUUID();
    await this.prisma.withPlatformBypass(async (client) => {
      const marked = await client.platformSubscriptionCommercialConfig.updateMany({
        where: { id, rowVersion: body.expectedRowVersion },
        data: {
          lifecycle: 'SUPERSEDED',
          isCurrent: false,
          rowVersion: { increment: 1 },
        },
      });
      if (marked.count !== 1) throw new ConflictException('Stale rowVersion.');
      if (operation === 'subscription.renew') {
        await this.maybeFail('after_renew_predecessor_lifecycle');
        await this.maybeFail('after_renew_predecessor_current_clear');
        await this.maybeFail('after_renew_predecessor_row_version');
      } else {
        await this.maybeFail('after_supersede_predecessor');
      }
      await client.platformSubscriptionCommercialConfig.create({
        data: {
          id: successorId,
          platformTenantId: existing.platformTenantId,
          platformSubscriptionId: existing.platformSubscriptionId,
          lifecycle: 'DRAFT',
          isCurrent: true,
          planVersionId: existing.planVersionId,
          commercialStart: successorCommercialStart,
          commercialEnd: successorCommercialEnd,
          predecessorId: id,
          createdByPlatformUserId: claims.sub,
          reasonCode: operation === 'subscription.renew' ? 'RENEW' : 'SUPERSEDE',
          reasonNote: body.reason.slice(0, 500),
        },
      });
      if (operation === 'subscription.renew') {
        await this.maybeFail('after_renew_successor_create');
        await this.maybeFail('after_renew_effective_date');
        await this.maybeFail('after_renew_plan_copy');
        await this.maybeFail('after_renew_correlation_copy');
        await this.maybeFail('after_renew_provenance');
        await this.maybeFail('after_renew_predecessor_link');
        await this.maybeFail('after_renew_successor_link');
        await this.maybeFail('after_renew_successor_current_set');
        await this.maybeFail('after_renew_successor_row_version');
      } else {
        await this.maybeFail('after_supersede_successor_create');
      }
      if (existing.addOnAssignments.length) {
        const addonRows = existing.addOnAssignments.map((a) => ({
          id: randomUUID(),
          configId: successorId,
          addOnVersionId: a.addOnVersionId,
        }));
        await client.platformSubscriptionAddOnAssignment.create({
          data: addonRows[0]!,
        });
        if (operation === 'subscription.renew') {
          await this.maybeFail('after_renew_addon_first_copy');
        }
        if (addonRows.length > 1) {
          await client.platformSubscriptionAddOnAssignment.createMany({
            data: addonRows.slice(1),
          });
        }
        if (operation === 'subscription.renew') {
          await this.maybeFail('after_renew_addon_partial_copy');
        }
      }
      if (existing.overrideAssignments.length) {
        const overrideRows = existing.overrideAssignments.map((a) => ({
          id: randomUUID(),
          configId: successorId,
          overrideId: a.overrideId,
        }));
        await client.platformSubscriptionOverrideAssignment.create({
          data: overrideRows[0]!,
        });
        if (operation === 'subscription.renew') {
          await this.maybeFail('after_renew_override_first_copy');
        }
        if (overrideRows.length > 1) {
          await client.platformSubscriptionOverrideAssignment.createMany({
            data: overrideRows.slice(1),
          });
        }
        if (operation === 'subscription.renew') {
          await this.maybeFail('after_renew_override_partial_copy');
        }
      }
      if (operation === 'subscription.renew') {
        // no-op markers retained for empty assignment sets
        if (!existing.addOnAssignments.length) {
          await this.maybeFail('after_renew_addon_first_copy');
          await this.maybeFail('after_renew_addon_partial_copy');
        }
        if (!existing.overrideAssignments.length) {
          await this.maybeFail('after_renew_override_first_copy');
          await this.maybeFail('after_renew_override_partial_copy');
        }
      } else {
        await this.maybeFail('after_supersede_assignment_copy');
        await this.maybeFail('after_supersede_current_transfer');
      }
      if (operation === 'subscription.renew') {
        await this.maybeFail('after_renew_audit_staging');
      }
      if (claim?.kind === 'proceed') {
        if (operation === 'subscription.renew') {
          await this.maybeFail('before_renew_idempotency');
        }
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: successorId,
        });
      }
      if (operation === 'subscription.renew') await this.maybeFail('before_renew_commit');
      else await this.maybeFail('before_supersede_commit');
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(
        client,
        claims,
        operation === 'subscription.renew'
          ? 'platform_subscription_commercial.renewed'
          : 'platform_subscription_commercial.superseded',
        successorId,
        {
          result: 'success',
          transitionCommand: operation === 'subscription.renew' ? 'RENEW' : 'SUPERSEDE',
          predecessorClassification: 'superseded',
          successorClassification: operation === 'subscription.renew' ? 'renewal_draft' : 'draft',
          lifecycleBefore: existing.lifecycle,
          lifecycleAfter: 'DRAFT',
          dateClassification:
            operation === 'subscription.renew' ? 'renewal_effective' : 'supersede_copy',
        },
      );
    });

    this.invalidateEffectiveRuntimeCache(existing.platformTenantId);
    return this.toDto(await this.loadConfig(successorId));
  }

  private async transitionLifecycle(
    claims: JwtClaimsVO,
    id: string,
    to: SubscriptionCommercialLifecycle,
    body: { expectedRowVersion: number; reason: string },
    operation: SubscriptionIdempotencyOperation,
    extra: Record<string, unknown>,
    idempotencyKey?: string,
    permission: 'subscription.migrate' | 'subscription.suspend' | 'subscription.cancel' = 'subscription.migrate',
    opts?: { provisioningAuthority?: boolean },
  ) {
    if (!opts?.provisioningAuthority) {
      const permissions = await this.permissionsFor(claims);
      this.require(permissions, permission);
      await this.requireFreshStepUp(claims);
      this.enforceRateLimit(claims.sub, 'highImpact');
    }
    if (operation === 'subscription.suspend') await this.maybeFail('after_suspend_auth');
    if (operation === 'subscription.resume') await this.maybeFail('after_resume_auth');
    const claim = await this.beginIdempotent(
      claims,
      operation,
      { id, to, ...body },
      idempotencyKey,
    );
    if (claim?.kind === 'replay') return this.toDto(await this.loadConfig(claim.id));

    const existing = await this.loadConfig(id);
    if (existing.rowVersion !== body.expectedRowVersion) {
      throw new ConflictException('Stale rowVersion.');
    }
    if (!canTransitionCommercialLifecycle(existing.lifecycle as SubscriptionCommercialLifecycle, to)) {
      throw new ConflictException('Invalid lifecycle transition.');
    }

    if (to === 'ACTIVE_COMMERCIAL' || to === 'SCHEDULED') {
      const from = existing.lifecycle as SubscriptionCommercialLifecycle;
      // Resume (SUSPENDED → ACTIVE_COMMERCIAL) does not re-validate assignment readiness.
      const requiresAssignmentReadiness =
        to === 'SCHEDULED' ||
        (to === 'ACTIVE_COMMERCIAL' && (from === 'DRAFT' || from === 'SCHEDULED'));
      if (requiresAssignmentReadiness) {
        if (to === 'SCHEDULED') await this.maybeFail('after_schedule_readiness');
        else await this.maybeFail('after_activate_readiness');
        const action: SubscriptionReadinessAction =
          to === 'SCHEDULED' ? 'schedule' : 'activate';
        const readiness = await this.computeReadiness(existing, action);
        if (readiness.status !== 'ready') {
          throw new BadRequestException({
            message: 'Commercial configuration is not ready.',
            code: 'readiness_blocked',
            blockers: readiness.blockers,
          });
        }
      }
    }

    let fingerprint: string | null = existing.commercialFingerprint;
    let snapshotPayload: Record<string, unknown> | null = null;
    if (to === 'ACTIVE_COMMERCIAL') {
      const fp = await this.buildFingerprint(existing);
      fingerprint = fp.fingerprint;
      snapshotPayload = fp.snapshot;
      await this.maybeFail('after_activate_fingerprint');
    }

    const currentStatePatch: Record<string, unknown> = {};
    if (to === 'ACTIVE_COMMERCIAL' || to === 'SCHEDULED' || to === 'SUSPENDED') {
      if (!isCurrentEligibleLifecycle(to)) {
        throw new ConflictException('Lifecycle is not eligible to remain current.');
      }
      currentStatePatch.isCurrent = true;
    }
    if (to === 'CANCELLED' || to === 'EXPIRED' || to === 'SUPERSEDED') {
      currentStatePatch.isCurrent = false;
    }

    await this.prisma.withPlatformBypass(async (client) => {
      const updated = await client.platformSubscriptionCommercialConfig.updateMany({
        where: { id, rowVersion: body.expectedRowVersion },
        data: {
          lifecycle: to,
          rowVersion: { increment: 1 },
          ...(to === 'ACTIVE_COMMERCIAL'
            ? {
                commercialFingerprint: fingerprint,
                fingerprintSchemaVersion: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
                activatedAt: new Date(),
                activatedByPlatformUserId: claims.sub,
              }
            : {}),
          ...extra,
          ...currentStatePatch,
        },
      });
      if (updated.count !== 1) throw new ConflictException('Stale rowVersion.');
      if (to === 'SCHEDULED') {
        await this.maybeFail('after_schedule_lifecycle');
        await this.maybeFail('after_schedule_metadata');
        await this.maybeFail('after_schedule_row_version');
      }
      if (to === 'ACTIVE_COMMERCIAL') {
        await this.maybeFail('after_activate_lifecycle');
        await this.maybeFail('after_activate_current_transfer');
      }
      if (to === 'SUSPENDED') {
        await this.maybeFail('after_suspend_lifecycle');
        await this.maybeFail('after_suspend_metadata');
        await this.maybeFail('after_suspend_row_version');
      }
      if (to === 'CANCELLED') {
        await this.maybeFail('after_cancel_lifecycle');
        await this.maybeFail('after_cancel_current_clear');
      }
      if (operation === 'subscription.resume') {
        await this.maybeFail('after_resume_lifecycle');
        await this.maybeFail('after_resume_metadata');
        await this.maybeFail('after_resume_row_version');
      }

      if (
        to === 'ACTIVE_COMMERCIAL' &&
        snapshotPayload &&
        fingerprint &&
        (existing.lifecycle === 'DRAFT' || existing.lifecycle === 'SCHEDULED')
      ) {
        await client.platformSubscriptionCommercialSnapshot.create({
          data: {
            id: randomUUID(),
            configId: id,
            fingerprint,
            fingerprintSchemaVersion: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
            snapshotPayload: snapshotPayload as Prisma.InputJsonValue,
          },
        });
        await this.maybeFail('after_activate_snapshot');
      }

      await client.platformSubscriptionCommercialChange.create({
        data: {
          id: randomUUID(),
          configId: id,
          action: `lifecycle.${to.toLowerCase()}`,
          actorId: claims.sub,
          beforeLifecycle: existing.lifecycle,
          afterLifecycle: to,
          metadataJson: { result: 'success', reasonCode: 'lifecycle_transition' },
        },
      });

      if (to === 'SCHEDULED') await this.maybeFail('after_schedule_audit_staging');
      if (to === 'SUSPENDED') await this.maybeFail('after_suspend_audit_staging');
      if (operation === 'subscription.resume') await this.maybeFail('after_resume_audit_staging');

      if (claim?.kind === 'proceed') {
        if (to === 'SCHEDULED') {
          await this.maybeFail('before_schedule_idempotency');
        }
        if (to === 'SUSPENDED') {
          await this.maybeFail('before_suspend_idempotency');
        }
        if (operation === 'subscription.resume') {
          await this.maybeFail('before_resume_idempotency');
        }
        await this.maybeFail('before_idempotency_complete');
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation,
          idempotencyKey: claim.idempotencyKey,
          requestHash: claim.requestHash,
          resultResourceType: 'subscriptionCommercialConfig',
          resultResourceId: id,
        });
      }
      if (to === 'SCHEDULED') await this.maybeFail('before_schedule_commit');
      if (to === 'ACTIVE_COMMERCIAL' && operation !== 'subscription.resume') {
        await this.maybeFail('before_activate_commit');
      }
      if (to === 'SUSPENDED') await this.maybeFail('before_suspend_commit');
      if (operation === 'subscription.resume') await this.maybeFail('before_resume_commit');
      if (to === 'CANCELLED') await this.maybeFail('before_cancel_commit');
      await this.maybeFail('before_transaction_commit');
      await this.auditMutation(
        client,
        claims,
        `platform_subscription_commercial.${to.toLowerCase()}`,
        id,
        {
          result: 'success',
          lifecycleBefore: existing.lifecycle,
          lifecycleAfter: to,
          /**
           * Option B — shared destination-state action for ACTIVE_COMMERCIAL.
           * Activate and resume both emit `...active_commercial` but are distinguished by
           * bounded transitionCommand = ACTIVATE | RESUME.
           */
          transitionCommand:
            operation === 'subscription.resume'
              ? 'RESUME'
              : operation === 'subscription.activate'
                ? 'ACTIVATE'
                : operation === 'subscription.schedule'
                  ? 'SCHEDULE'
                  : operation === 'subscription.suspend'
                    ? 'SUSPEND'
                    : operation === 'subscription.cancel'
                      ? 'CANCEL'
                      : undefined,
          fingerprintSchema: fingerprint ? SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA : undefined,
          expectedVersion: String(body.expectedRowVersion),
          resultingVersion: String(body.expectedRowVersion + 1),
        },
      );
    });

    this.invalidateEffectiveRuntimeCache(existing.platformTenantId);
    return this.toDto(await this.loadConfig(id));
  }

  /**
   * Frozen runtime-subscription correlation contract:
   * - Never select by createdAt / arbitrary order / plan tier / frontend list order.
   * - Zero runtime rows: correlation optional (null allowed permanently).
   * - One runtime row: correlation optional (explicit id still validated).
   * - Multiple runtime rows: explicit correlation required (fail closed).
   * - Cross-tenant correlation rejected.
   * - Invalid/deleted correlation rejected.
   * - Many historical commercial configs may share one correlation.
   * - FK Restrict; Step 16 never creates/updates runtime subscription rows.
   * - No runtime licensing effect from correlation.
   */
  private async assertCorrelationForWrite(
    platformTenantId: string,
    platformSubscriptionId: string | null,
    stage: 'create' | 'readiness',
  ): Promise<void> {
    const runtimeSubs = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscription.findMany({
        where: { platformTenantId },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    );
    if (platformSubscriptionId) {
      const owned = runtimeSubs.some((s) => s.id === platformSubscriptionId);
      if (!owned) {
        const any = await this.prisma.withPlatformBypass((client) =>
          client.platformSubscription.findUnique({
            where: { id: platformSubscriptionId },
            select: { id: true, platformTenantId: true },
          }),
        );
        if (!any) {
          throw new BadRequestException({
            message: 'Runtime subscription correlation is invalid.',
            code: 'correlation_invalid',
          });
        }
        throw new BadRequestException({
          message: 'Runtime subscription correlation belongs to another tenant.',
          code: 'correlation_cross_tenant',
        });
      }
      return;
    }
    if (runtimeSubs.length > 1) {
      throw new BadRequestException({
        message:
          stage === 'create'
            ? 'Explicit runtime subscription correlation is required when multiple runtime subscriptions exist.'
            : 'Correlation required: multiple runtime subscriptions exist and none is selected.',
        code: 'correlation_ambiguous',
      });
    }
  }

  private async assertTenantEligibleForCommercialMutation(
    platformTenantId: string,
    action: SubscriptionReadinessAction,
  ): Promise<void> {
    const tenant = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({ where: { id: platformTenantId } }),
    );
    if (!tenant) {
      throw new BadRequestException({
        message: 'Platform tenant missing.',
        code: 'tenant_missing',
      });
    }
    if (isPlatformAuditSentinelTenantId(tenant.tenantId)) {
      throw new BadRequestException({
        message: 'Sentinel tenant is ineligible.',
        code: 'tenant_sentinel',
      });
    }
    if (tenant.status === 'ARCHIVED') {
      throw new BadRequestException({
        message: 'Tenant is archived.',
        code: 'tenant_archived',
      });
    }
    if (tenant.status === 'SUSPENDED') {
      throw new BadRequestException({
        message: 'Tenant lifecycle is ineligible for commercial mutation.',
        code: 'tenant_lifecycle_ineligible',
        action,
        ready: false,
      });
    }
  }

  private assertDraftMutable(existing: { lifecycle: string; rowVersion: number }, expected: number) {
    if (!isCommercialConfigMutable(existing.lifecycle as SubscriptionCommercialLifecycle)) {
      throw new ConflictException('Only Draft commercial configurations are editable.');
    }
    if (existing.rowVersion !== expected) throw new ConflictException('Stale rowVersion.');
  }

  private assertDateOrder(start: Date | null, end: Date | null) {
    if (start && end && !(start < end)) {
      throw new BadRequestException('commercialStart must precede commercialEnd.');
    }
  }

  private async assertEligiblePlanVersion(planVersionId: string) {
    const pv = await this.prisma.withPlatformBypass((client) =>
      client.platformPlanVersion.findUnique({
        where: { id: planVersionId },
        include: { plan: true },
      }),
    );
    if (!pv) throw new NotFoundException('Plan Version not found.');
    if (pv.lifecycle !== 'PUBLISHED') {
      throw new BadRequestException('Only Published Plan Versions may be assigned.');
    }
    if (pv.plan.lifecycle === 'ARCHIVED') {
      throw new BadRequestException('Archived Plans cannot be newly assigned.');
    }
    if (pv.plan.canonicalKey === 'plan.business') {
      throw new BadRequestException('plan.business is not a canonical Plan.');
    }
    if (!pv.publicationFingerprint) {
      throw new BadRequestException('Plan Version publication fingerprint is required.');
    }
  }

  private async assertEligibleAddonVersions(
    ids: string[],
    planCanonicalKey: string,
    planVersionId: string,
  ) {
    if (!ids.length) return;
    const versions = await this.prisma.withPlatformBypass((client) =>
      client.platformAddOnVersion.findMany({
        where: { id: { in: ids } },
        include: {
          applicability: true,
          addOn: true,
          entitlements: { include: { catalogItem: { include: { owningModule: true } } } },
          limitEffects: { include: { catalogItem: true } },
        },
      }),
    );
    if (versions.length !== ids.length) {
      throw new BadRequestException({
        message: 'One or more Add-on Versions were not found.',
        code: 'addon_version_unknown',
      });
    }
    for (const v of versions) {
      if (v.lifecycle !== 'PUBLISHED') {
        throw new BadRequestException({
          message: 'Only Published Add-on Versions may be newly assigned.',
          code: v.lifecycle === 'DRAFT' ? 'addon_draft_rejected' : 'addon_retired_rejected',
        });
      }
      if (v.addOn.lifecycle === 'ARCHIVED') {
        throw new BadRequestException({
          message: 'Archived Add-on identities cannot be newly assigned.',
          code: 'addon_identity_archived',
        });
      }
      const applicable = v.applicability.some((a) => a.planCanonicalKey === planCanonicalKey);
      if (!applicable) {
        throw new BadRequestException({
          message: `Add-on Version ${v.id} is not applicable to ${planCanonicalKey}.`,
          code: 'addon_inapplicable',
        });
      }
    }

    const planVersion = await this.prisma.withPlatformBypass((client) =>
      client.platformPlanVersion.findUnique({
        where: { id: planVersionId },
        include: {
          entitlements: { include: { catalogItem: true } },
          limits: { include: { catalogItem: true } },
        },
      }),
    );
    if (!planVersion) {
      throw new BadRequestException({ message: 'Plan Version missing.', code: 'plan_version_missing' });
    }

    const orderedVersions = [...versions].sort((a, b) => a.id.localeCompare(b.id));
    const composition = composeCommercialPreview({
      baseEntitlements: planVersion.entitlements.map((e) => e.catalogItem.canonicalKey),
      baseLimits: planVersion.limits.map((l) => ({
        canonicalKey: l.catalogItem.canonicalKey,
        unlimited: l.unlimited,
        valueText: l.valueText,
      })),
      addOns: orderedVersions.map((v) => ({
        addOnVersionId: v.id,
        entitlements: v.entitlements.map((e) => e.catalogItem.canonicalKey),
        limitEffects: v.limitEffects.map((e) => ({
          canonicalKey: e.catalogItem.canonicalKey,
          effectType: e.effectType as 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED',
          unlimited: e.unlimited,
          valueText: e.valueText,
        })),
      })),
      overrides: [],
    });
    if (composition.conflicts.length) {
      const first = composition.conflicts[0];
      throw new BadRequestException({
        message: first.message,
        code:
          first.code === 'contradictory_addon_absolute_limits'
            ? 'addon_limit_conflict'
            : first.code === 'numeric_overflow'
              ? 'addon_limit_overflow'
              : 'addon_composition_conflict',
        conflicts: composition.conflicts,
      });
    }

    const entitlementKeys = new Set<string>([
      ...planVersion.entitlements.map((e) => e.catalogItem.canonicalKey),
      ...orderedVersions.flatMap((v) => v.entitlements.map((e) => e.catalogItem.canonicalKey)),
    ]);

    // Dependency: FEATURE owning-module must be present in base∪addon entitlements.
    for (const v of orderedVersions) {
      for (const ent of v.entitlements) {
        const owning = ent.catalogItem.owningModule?.canonicalKey;
        if (owning && !entitlementKeys.has(owning)) {
          throw new BadRequestException({
            message: `Add-on Version ${v.id} requires module ${owning}.`,
            code: 'addon_dependency_missing',
            ref: ent.catalogItem.canonicalKey,
          });
        }
      }
    }

    // Compatibility + exclusivity via ACTIVE Catalog INCOMPATIBLE_WITH rules.
    const catalogItems = await this.prisma.withPlatformBypass((client) =>
      client.healthcareCatalogItem.findMany({
        where: { canonicalKey: { in: [...entitlementKeys] } },
        select: { id: true, canonicalKey: true },
      }),
    );
    const itemIds = catalogItems.map((c) => c.id);
    if (itemIds.length >= 2) {
      const rules = await this.prisma.withPlatformBypass((client) =>
        client.healthcareCatalogCompatibilityRule.findMany({
          where: {
            lifecycle: 'ACTIVE',
            ruleType: 'INCOMPATIBLE_WITH',
            subjectItemId: { in: itemIds },
            targetItemId: { in: itemIds },
          },
          include: {
            subject: { select: { canonicalKey: true } },
            target: { select: { canonicalKey: true } },
          },
        }),
      );
      for (const rule of rules) {
        if (
          entitlementKeys.has(rule.subject.canonicalKey) &&
          entitlementKeys.has(rule.target.canonicalKey)
        ) {
          const subjectFromAddons = orderedVersions.filter((v) =>
            v.entitlements.some((e) => e.catalogItem.canonicalKey === rule.subject.canonicalKey),
          );
          const targetFromAddons = orderedVersions.filter((v) =>
            v.entitlements.some((e) => e.catalogItem.canonicalKey === rule.target.canonicalKey),
          );
          const distinctAddonConflict =
            subjectFromAddons.length > 0 &&
            targetFromAddons.length > 0 &&
            !subjectFromAddons.every((s) => targetFromAddons.includes(s));
          throw new BadRequestException({
            message: `Incompatible capabilities ${rule.subject.canonicalKey} and ${rule.target.canonicalKey}.`,
            code: distinctAddonConflict ? 'addon_mutually_exclusive' : 'addon_compatibility_conflict',
          });
        }
      }
    }
  }

  private async assertEligibleOverrides(
    ids: string[],
    existing: Awaited<ReturnType<typeof this.loadConfig>>,
  ) {
    if (!ids.length) return;
    const now = new Date();
    const rows = await this.prisma.withPlatformBypass((client) =>
      client.platformCommercialOverride.findMany({
        where: { id: { in: ids } },
        include: { effects: { include: { catalogItem: true } } },
      }),
    );
    if (rows.length !== ids.length) {
      throw new BadRequestException({
        message: 'One or more Overrides were not found.',
        code: 'override_unknown',
      });
    }
    for (const o of rows) {
      if (o.lifecycle !== 'APPROVED') {
        const codeByLifecycle: Record<string, string> = {
          DRAFT: 'override_draft_rejected',
          PENDING_APPROVAL: 'override_pending_rejected',
          REJECTED: 'override_rejected_lifecycle',
          REVOKED: 'override_revoked_rejected',
          EXPIRED: 'override_expired_rejected',
        };
        throw new BadRequestException({
          message: 'Only Approved Overrides may be newly assigned.',
          code: codeByLifecycle[o.lifecycle] ?? 'override_not_approved',
        });
      }
      if (!o.approvedByPlatformUserId) {
        throw new BadRequestException({
          message: 'Approved Override is missing approver identity.',
          code: 'override_governance_approver_missing',
        });
      }
      if (!o.approvedAt) {
        throw new BadRequestException({
          message: 'Approved Override is missing approval timestamp.',
          code: 'override_governance_approved_at_missing',
        });
      }
      if (o.approvedByPlatformUserId === o.createdByPlatformUserId) {
        throw new BadRequestException({
          message: 'Maker-checker separation required: creator cannot equal approver.',
          code: 'override_governance_self_approved',
        });
      }
      if (!o.compositionFingerprint?.trim()) {
        throw new BadRequestException({
          message: 'Approved Override immutable fingerprint is required.',
          code: 'override_governance_fingerprint_missing',
        });
      }
      if (o.expiresAt && o.expiresAt <= now) {
        throw new BadRequestException({
          message: 'Expired Overrides cannot be newly assigned.',
          code: 'override_expired',
        });
      }
      // Definition-scoped: Overrides have no tenantId; assignment FK is the only binding.
    }

    if (!existing.planVersionId) {
      // Overrides may be staged on Draft without plan; composition conflicts deferred to activate readiness.
      return;
    }

    const planVersion = await this.prisma.withPlatformBypass((client) =>
      client.platformPlanVersion.findUnique({
        where: { id: existing.planVersionId! },
        include: {
          entitlements: { include: { catalogItem: true } },
          limits: { include: { catalogItem: true } },
        },
      }),
    );
    if (!planVersion) return;

    const addonIds = existing.addOnAssignments.map((a) => a.addOnVersionId);
    const addOnVersions =
      addonIds.length === 0
        ? []
        : await this.prisma.withPlatformBypass((client) =>
            client.platformAddOnVersion.findMany({
              where: { id: { in: addonIds } },
              include: {
                entitlements: { include: { catalogItem: true } },
                limitEffects: { include: { catalogItem: true } },
              },
            }),
          );

    const orderedOverrides = [...rows].sort((a, b) => a.id.localeCompare(b.id));
    const composition = composeCommercialPreview({
      baseEntitlements: planVersion.entitlements.map((e) => e.catalogItem.canonicalKey),
      baseLimits: planVersion.limits.map((l) => ({
        canonicalKey: l.catalogItem.canonicalKey,
        unlimited: l.unlimited,
        valueText: l.valueText,
      })),
      addOns: addOnVersions.map((v) => ({
        addOnVersionId: v.id,
        entitlements: v.entitlements.map((e) => e.catalogItem.canonicalKey),
        limitEffects: v.limitEffects.map((e) => ({
          canonicalKey: e.catalogItem.canonicalKey,
          effectType: e.effectType as 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED',
          unlimited: e.unlimited,
          valueText: e.valueText,
        })),
      })),
      overrides: orderedOverrides.map((o) => ({
        overrideId: o.id,
        effects: o.effects.map((e) => ({
          effectKind: e.effectKind as
            | 'ENTITLEMENT_GRANT'
            | 'ENTITLEMENT_SUPPRESS'
            | 'LIMIT_SET_ABSOLUTE'
            | 'LIMIT_INCREASE_BY'
            | 'LIMIT_SET_UNLIMITED',
          canonicalKey: e.catalogItem.canonicalKey,
          unlimited: e.unlimited,
          valueText: e.valueText,
        })),
      })),
    });
    if (composition.conflicts.length) {
      const first = composition.conflicts[0];
      throw new BadRequestException({
        message: first.message,
        code:
          first.code === 'contradictory_entitlement_effects'
            ? 'override_contradiction'
            : first.code === 'contradictory_absolute_limits'
              ? 'override_limit_conflict'
              : 'override_composition_conflict',
        conflicts: composition.conflicts,
      });
    }
  }

  private async computeReadiness(
    row: Awaited<ReturnType<typeof this.loadConfig>>,
    action: SubscriptionReadinessAction = 'activate',
  ) {
    const blockers: Array<{ code: string; message: string; ref?: string }> = [];
    const warnings: Array<{ code: string; message: string; ref?: string }> = [];

    const tenant = await this.prisma.withPlatformBypass((client) =>
      client.platformTenant.findUnique({ where: { id: row.platformTenantId } }),
    );
    if (!tenant) blockers.push({ code: 'tenant_missing', message: 'Platform tenant missing.' });
    else if (isPlatformAuditSentinelTenantId(tenant.tenantId)) {
      blockers.push({
        code: 'tenant_sentinel',
        message: 'Sentinel tenant is ineligible.',
        ref: tenant.tenantId,
      });
    } else if (tenant.status === 'ARCHIVED') {
      blockers.push({
        code: 'tenant_archived',
        message: 'Tenant is archived.',
        ref: row.platformTenantId,
      });
    } else if (tenant.status === 'SUSPENDED') {
      const tenantIssue = {
        code: 'tenant_lifecycle_ineligible',
        message: 'Tenant is suspended; commercial mutation and activation are blocked.',
        ref: row.platformTenantId,
      };
      // Preview is read-only: warning only. All mutation actions: BLOCKER.
      if (action === 'preview') {
        warnings.push(tenantIssue);
      } else {
        blockers.push(tenantIssue);
      }
    }

    const runtimeSubs = await this.prisma.withPlatformBypass((client) =>
      client.platformSubscription.findMany({
        where: { platformTenantId: row.platformTenantId },
        select: { id: true },
        orderBy: { id: 'asc' },
      }),
    );
    if (row.platformSubscriptionId) {
      const owned = runtimeSubs.some((s) => s.id === row.platformSubscriptionId);
      if (!owned) {
        const any = await this.prisma.withPlatformBypass((client) =>
          client.platformSubscription.findUnique({
            where: { id: row.platformSubscriptionId! },
            select: { id: true },
          }),
        );
        blockers.push({
          code: any ? 'correlation_cross_tenant' : 'correlation_invalid',
          message: any
            ? 'Correlation references another tenant runtime subscription.'
            : 'Correlation references a missing runtime subscription.',
          ref: row.platformSubscriptionId,
        });
      }
    } else if (runtimeSubs.length > 1) {
      blockers.push({
        code: 'correlation_ambiguous',
        message:
          'Multiple runtime subscriptions exist; explicit correlation is required (never selected by createdAt).',
        ref: row.platformTenantId,
      });
      blockers.push({
        code: 'correlation_required',
        message: 'Correlation is required when multiple runtime subscriptions exist.',
        ref: row.platformTenantId,
      });
    } else if (runtimeSubs.length === 1) {
      warnings.push({
        code: 'correlation_optional_uncorrelated',
        message:
          'Configuration is uncorrelated while exactly one runtime subscription exists (allowed; no auto-bind).',
        ref: runtimeSubs[0].id,
      });
    }

    const lifecycle = row.lifecycle as SubscriptionCommercialLifecycle;
    if (!isCommercialConfigMutable(lifecycle)) {
      const issue = {
        code: 'lifecycle_not_editable',
        message: 'Configuration lifecycle is not editable.',
        ref: lifecycle,
      };
      if (isEditReadinessAction(action)) blockers.push(issue);
      else if (action === 'preview') warnings.push(issue);
    }
    if (lifecycle !== 'DRAFT' && lifecycle !== 'SCHEDULED') {
      const issue = {
        code: 'lifecycle_not_activatable',
        message: 'Lifecycle cannot newly activate from the current state (resume excluded).',
        ref: lifecycle,
      };
      if (action === 'activate') blockers.push(issue);
      else if (action === 'preview') warnings.push(issue);
    }
    if (lifecycle !== 'DRAFT') {
      const issue = {
        code: 'lifecycle_not_schedulable',
        message: 'Only Draft configurations may be scheduled.',
        ref: lifecycle,
      };
      if (action === 'schedule') blockers.push(issue);
      else if (action === 'preview') warnings.push(issue);
    }

    const requiresActivationCompleteness =
      action === 'activate' || action === 'schedule' || action === 'preview';

    if (requiresActivationCompleteness) {
    if (!row.planVersionId) {
      blockers.push({ code: 'plan_version_required', message: 'Plan Version is required.' });
      blockers.push({ code: 'plan_required', message: 'Plan is required.' });
    } else if (!row.planVersion) {
      blockers.push({
        code: 'plan_version_missing',
        message: 'Plan Version row is missing.',
        ref: row.planVersionId,
      });
    } else if (row.planVersion.lifecycle === 'RETIRED') {
      blockers.push({
        code: 'plan_version_retired',
        message: 'Retired Plan Versions cannot be newly activated.',
        ref: row.planVersionId,
      });
    } else if (row.planVersion.lifecycle !== 'PUBLISHED') {
      blockers.push({
        code: 'plan_version_not_published',
        message: 'Plan Version must be Published.',
        ref: row.planVersionId,
      });
    } else if (!row.planVersion.publicationFingerprint) {
      blockers.push({
        code: 'plan_fingerprint_missing',
        message: 'Plan fingerprint missing.',
        ref: row.planVersionId,
      });
      blockers.push({
        code: 'source_fingerprint_missing',
        message: 'Source Plan publication fingerprint missing.',
        ref: row.planVersionId,
      });
    } else if (row.planVersion.plan.canonicalKey === 'plan.business') {
      blockers.push({
        code: 'plan_business_rejected',
        message: 'plan.business is rejected.',
        ref: row.planVersionId,
      });
    }

    const seenAddonKeys = new Set<string>();
    for (const a of [...row.addOnAssignments].sort((x, y) =>
      x.addOnVersionId.localeCompare(y.addOnVersionId),
    )) {
      if (seenAddonKeys.has(a.addOnVersionId)) {
        blockers.push({
          code: 'addon_duplicate',
          message: `Duplicate Add-on Version ${a.addOnVersionId}.`,
          ref: a.addOnVersionId,
        });
      }
      seenAddonKeys.add(a.addOnVersionId);
      if (!a.addOnVersion) {
        blockers.push({
          code: 'addon_version_missing',
          message: `Add-on Version ${a.addOnVersionId} missing.`,
          ref: a.addOnVersionId,
        });
        continue;
      }
      if (a.addOnVersion.lifecycle === 'RETIRED') {
        blockers.push({
          code: 'addon_retired',
          message: `Add-on ${a.addOnVersionId} is Retired for new activation.`,
          ref: a.addOnVersionId,
        });
      } else if (a.addOnVersion.lifecycle !== 'PUBLISHED') {
        blockers.push({
          code: 'addon_not_published',
          message: `Add-on ${a.addOnVersionId} not Published.`,
          ref: a.addOnVersionId,
        });
      }
      if (row.planVersion?.plan?.canonicalKey) {
        const applicable = (a.addOnVersion as { applicability?: Array<{ planCanonicalKey: string }> })
          .applicability;
        if (
          Array.isArray(applicable) &&
          applicable.length > 0 &&
          !applicable.some((x) => x.planCanonicalKey === row.planVersion!.plan.canonicalKey)
        ) {
          blockers.push({
            code: 'addon_inapplicable',
            message: `Add-on ${a.addOnVersionId} not applicable to selected Plan.`,
            ref: a.addOnVersionId,
          });
        }
      }
    }

    const now = new Date();
    const seenOverrideIds = new Set<string>();
    for (const o of [...row.overrideAssignments].sort((x, y) =>
      x.overrideId.localeCompare(y.overrideId),
    )) {
      if (seenOverrideIds.has(o.overrideId)) {
        blockers.push({
          code: 'override_duplicate',
          message: `Duplicate Override ${o.overrideId}.`,
          ref: o.overrideId,
        });
      }
      seenOverrideIds.add(o.overrideId);
      if (!o.override) {
        blockers.push({
          code: 'override_missing',
          message: `Override ${o.overrideId} missing.`,
          ref: o.overrideId,
        });
        continue;
      }
      if (o.override.lifecycle === 'REVOKED') {
        blockers.push({
          code: 'override_revoked',
          message: `Override ${o.overrideId} is revoked.`,
          ref: o.overrideId,
        });
      } else if (o.override.lifecycle !== 'APPROVED') {
        blockers.push({
          code: 'override_not_approved',
          message: `Override ${o.overrideId} not Approved.`,
          ref: o.overrideId,
        });
      }
      if (o.override.expiresAt && o.override.expiresAt <= now) {
        blockers.push({
          code: 'override_expired',
          message: `Override ${o.overrideId} is expired.`,
          ref: o.overrideId,
        });
      }
      if (o.override.effectiveFrom && o.override.effectiveFrom > now) {
        const severity = futureEffectiveOverrideSeverity({
          action,
          effectiveFrom: o.override.effectiveFrom,
          now,
          scheduledActivationAt: row.scheduledActivationAt,
        });
        const issue = {
          code: 'override_future_effective',
          message: `Override ${o.overrideId} is future-effective.`,
          ref: o.overrideId,
        };
        if (severity === 'blocker') blockers.push(issue);
        else if (severity === 'warning') warnings.push(issue);
      }
    }

    if (row.commercialStart && row.commercialEnd && !(row.commercialStart < row.commercialEnd)) {
      blockers.push({ code: 'dates_invalid', message: 'commercialStart must precede commercialEnd.' });
      blockers.push({
        code: 'start_after_end',
        message: 'commercialStart must precede commercialEnd.',
      });
    }
    if (
      row.scheduledActivationAt &&
      row.commercialStart &&
      row.scheduledActivationAt < row.commercialStart
    ) {
      blockers.push({
        code: 'invalid_schedule_date',
        message: 'scheduledActivationAt must not precede commercialStart.',
      });
    }

    if (!row.planVersionId || blockers.some((b) => b.code.startsWith('plan_'))) {
      blockers.push({
        code: 'fingerprint_unavailable',
        message: 'Candidate commercial fingerprint cannot be computed.',
      });
      blockers.push({
        code: 'snapshot_input_incomplete',
        message: 'Snapshot inputs are incomplete.',
      });
    }
    } else {
      // Draft edit / assign / dates: surface future-effective Overrides as warnings only.
      const now = new Date();
      for (const o of row.overrideAssignments) {
        if (o.override?.effectiveFrom && o.override.effectiveFrom > now) {
          warnings.push({
            code: 'override_future_effective',
            message: `Override ${o.overrideId} is future-effective.`,
            ref: o.overrideId,
          });
        }
      }
    }

    blockers.sort((a, b) => a.code.localeCompare(b.code) || (a.ref ?? '').localeCompare(b.ref ?? ''));
    warnings.sort((a, b) => a.code.localeCompare(b.code) || (a.ref ?? '').localeCompare(b.ref ?? ''));

    return {
      status: blockers.length === 0 ? 'ready' : 'blocked',
      action,
      blockers,
      warnings,
      fingerprintAvailable: blockers.length === 0 && !!row.planVersionId,
      runtimeEffective: RUNTIME_EFFECTIVE,
      disclaimer: COMMERCIAL_RUNTIME_DISCLAIMER,
    };
  }

  private async buildFingerprint(row: Awaited<ReturnType<typeof this.loadConfig>>) {
    if (!row.planVersion) throw new BadRequestException('Plan Version required for fingerprint.');
    const fingerprint = computeSubscriptionCommercialFingerprint({
      platformTenantId: row.platformTenantId,
      platformSubscriptionId: row.platformSubscriptionId ?? null,
      planCanonicalKey: row.planVersion.plan.canonicalKey,
      planVersionId: row.planVersion.id,
      planVersionNumber: row.planVersion.versionNumber,
      planPublicationFingerprint: row.planVersion.publicationFingerprint ?? '',
      addonVersionIds: row.addOnAssignments.map((a) => a.addOnVersionId),
      addonFingerprints: row.addOnAssignments.map(
        (a) => a.addOnVersion.publicationFingerprint ?? '',
      ),
      overrideIds: row.overrideAssignments.map((a) => a.overrideId),
      overrideFingerprints: row.overrideAssignments.map(
        (a) => a.override.compositionFingerprint ?? a.overrideId,
      ),
      commercialStart: row.commercialStart?.toISOString() ?? null,
      commercialEnd: row.commercialEnd?.toISOString() ?? null,
      scheduledActivationAt: row.scheduledActivationAt?.toISOString() ?? null,
    });
    const snapshot = {
      schema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      platformTenantId: row.platformTenantId,
      platformSubscriptionId: row.platformSubscriptionId ?? null,
      planVersionId: row.planVersionId,
      planCanonicalKey: row.planVersion.plan.canonicalKey,
      planVersionNumber: row.planVersion.versionNumber,
      planPublicationFingerprint: row.planVersion.publicationFingerprint,
      addonVersionIds: row.addOnAssignments.map((a) => a.addOnVersionId).sort(),
      overrideIds: row.overrideAssignments.map((a) => a.overrideId).sort(),
      commercialStart: row.commercialStart?.toISOString() ?? null,
      commercialEnd: row.commercialEnd?.toISOString() ?? null,
      scheduledActivationAt: row.scheduledActivationAt?.toISOString() ?? null,
      fingerprint,
      runtimeEffective: false,
    };
    return { fingerprint, snapshot };
  }
}
