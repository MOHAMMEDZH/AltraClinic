import { randomUUID } from 'crypto';
import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { RefreshTokenRepository } from '../../auth/domain/repositories/refresh-token.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from '../../../infrastructure/provider.tokens';
import { PlatformSubscriptionsService } from '../../platform-subscriptions/application/platform-subscriptions.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { PlatformTenant } from '../../platform-admin/domain/entities/platform-tenant.entity';
import { CreateTenantHandler } from '../../tenant/application/handlers/create-tenant.handler';
import { CreateTenantCommand } from '../../tenant/application/commands/create-tenant.command';
import { ProvisioningIdempotencyService } from './provisioning-idempotency.service';
import { TenantProvisioningValidationService } from './tenant-provisioning-validation.service';
import { TenantAdminInvitationAdapter } from './tenant-admin-invitation.adapter';
import { TenantProvisioningRateLimitService } from './tenant-provisioning-rate-limit.service';
import { TenantProvisioningAuditLog } from './tenant-provisioning-audit.log';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';
import {
  isTenantProvisioningEnabled,
  TENANT_PROVISIONING_DISABLED_CODE,
  TENANT_PROVISIONING_DISABLED_MESSAGE,
} from '../config/tenant-provisioning-flags';
import { PROVISION_PERMISSIONS } from '../tenant-provisioning.constants';
import {
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import {
  PROVISIONING_CHECKPOINTS,
  PROVISIONING_FAILURE_INJECTION_ENV,
  TenantProvisioningError,
  type OnboardingType,
  type ProvisioningCheckpointKey,
  type ProvisioningProgressDto,
  type ProvisioningStatus,
  type TenantProvisioningRequestInput,
} from '../domain/tenant-provisioning.types';

/** Prisma tx client; `any` avoids contravariant upsert arg mismatch with Prisma generics. */
type AuditTxClient = any;

function planKeyToLegacyTier(planKey: string | undefined): string {
  if (planKey === 'plan.enterprise') return 'enterprise';
  if (planKey === 'plan.pro' || planKey === 'plan.business') return 'growth';
  return 'starter';
}

function resolveDomainRegion(raw: string | null | undefined): string {
  const v = (raw ?? 'me-central').trim().toLowerCase();
  if (v === 'eu-west' || v === 'eu_west') return 'eu-west';
  if (v === 'us-east' || v === 'us_east') return 'us-east';
  return 'me-central';
}

function domainRegionToPrisma(region: string): 'ME_SOUTH' | 'EU_WEST' | 'US_EAST' {
  if (region === 'eu-west') return 'EU_WEST';
  if (region === 'us-east') return 'US_EAST';
  return 'ME_SOUTH';
}

@Injectable()
export class TenantProvisioningService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validation: TenantProvisioningValidationService,
    private readonly idempotency: ProvisioningIdempotencyService,
    private readonly invitations: TenantAdminInvitationAdapter,
    private readonly rateLimit: TenantProvisioningRateLimitService,
    private readonly subscriptions: PlatformSubscriptionsService,
    private readonly eer: EffectiveEntitlementRuntimeService,
    private readonly createTenant: CreateTenantHandler,
    private readonly authorization: PlatformAuthorizationService,
    private readonly assurance: PlatformAssuranceService,
    private readonly auditLog: TenantProvisioningAuditLog,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly refreshRepo: RefreshTokenRepository,
  ) {}

  private assertEnabled(): void {
    if (!isTenantProvisioningEnabled()) {
      throw new TenantProvisioningError(
        TENANT_PROVISIONING_DISABLED_CODE,
        TENANT_PROVISIONING_DISABLED_MESSAGE,
        503,
      );
    }
  }

  async validate(claims: JwtClaimsVO, body: TenantProvisioningRequestInput) {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.assertCanValidate(claims);
    try {
      this.validation.assertNoProhibitedFields(body);
    } catch (err) {
      const e = err as { code?: string; field?: string; message?: string };
      return {
        valid: false,
        errors: [{ code: e.code ?? 'prohibited_field', field: e.field }],
        warnings: [],
      };
    }
    const salesTrialOnly = await this.isSalesTrialOnly(claims);
    return this.validation.validate(body, { salesTrialOnly });
  }

  async createRequest(
    claims: JwtClaimsVO,
    body: TenantProvisioningRequestInput,
    idempotencyKey?: string,
  ): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'mutation');
    const salesTrialOnly = await this.isSalesTrialOnly(claims);
    await this.assertCanCreate(claims, body.onboardingType, salesTrialOnly);
    this.validation.assertNoProhibitedFields(body);

    const key = idempotencyKey ?? `create:${claims.sub}:${body.externalRequestId ?? randomUUID()}`;
    const requestHash = this.idempotency.fingerprint({ op: 'CREATE_PROVISIONING_REQUEST', body });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: 'CREATE_PROVISIONING_REQUEST',
      idempotencyKey: key,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return this.getProgress(claims, gate.resultResourceId);
    }

    const validated = await this.validation.validate(body, { salesTrialOnly });
    if (!validated.valid) {
      throw new TenantProvisioningError('validation_failed', 'Provisioning request failed validation.', 400);
    }

    this.maybeInjectFailure('after_validation');

    const id = randomUUID();
    const correlationId = randomUUID();
    const slug = this.validation.normalizeSlug(body.organization.requestedSlug) ?? null;
    const specialtyKeys = [...body.specialtyKeys];

    let replayResourceId: string | null = null;

    await this.prisma.withPlatformBypass(async (client) => {
      await client.$executeRawUnsafe(
        `SELECT pg_advisory_xact_lock(hashtext($1))`,
        `prov-idem:${claims.sub}:${key}`,
      );
      if (slug) {
        await client.$executeRawUnsafe(
          `SELECT pg_advisory_xact_lock(hashtext($1))`,
          `prov-slug:${slug}`,
        );
      }

      this.maybeInjectFailure('after_idempotency_claim');

      const existingIdem = await client.platformTenantProvisioningIdempotencyRecord.findUnique({
        where: {
          actorId_operation_idempotencyKey: {
            actorId: claims.sub,
            operation: 'CREATE_PROVISIONING_REQUEST',
            idempotencyKey: key,
          },
        },
      });
      if (existingIdem?.status === 'completed' && existingIdem.expiresAt > new Date()) {
        if (existingIdem.requestHash !== requestHash) {
          throw new ConflictException('Idempotency key was reused with a different request.');
        }
        replayResourceId = existingIdem.resultResourceId;
        return;
      }

      if (slug) {
        const slugTaken = await client.tenant.findFirst({
          where: { slug, deletedAt: null },
          select: { id: true },
        });
        const slugReserved = await client.platformTenantProvisioningRequest.findFirst({
          where: {
            reservedSlug: slug,
            status: {
              in: ['REQUESTED', 'VALIDATING', 'READY', 'PROVISIONING', 'AWAITING_ACTIVATION'],
            },
          },
          select: { id: true },
        });
        if (slugTaken || slugReserved) {
          throw new ConflictException({
            code: 'slug_conflict',
            message: 'Slug already reserved or taken.',
          });
        }
      }

      await client.platformTenantProvisioningRequest.create({
        data: {
          id,
          status: 'READY',
          organizationName: body.organization.legalOrDisplayName.trim(),
          requestedSlug: slug,
          reservedSlug: slug,
          region: body.organization.regionOrEnvironment?.trim() || null,
          timezone: body.organization.timezone?.trim() || 'UTC',
          facilityTypeKey: body.facilityTypeKey,
          specialtyKeys,
          publishedPlanVersionId: body.publishedPlanVersionId,
          addOnSelections: body.addOnSelections ?? [],
          adminEmail: body.tenantAdmin.email.toLowerCase().trim(),
          adminDisplayName: body.tenantAdmin.displayName?.trim() || null,
          adminLocale: body.tenantAdmin.locale?.trim() || null,
          onboardingType: body.onboardingType,
          requestedStartAt: body.requestedStartAt ? new Date(body.requestedStartAt) : null,
          salesAttributionId: body.salesAttributionId?.trim() || null,
          externalRequestId: body.externalRequestId?.trim() || null,
          previewFingerprint: validated.previewFingerprint ?? null,
          compatibilityFingerprint: validated.compatibilityFingerprint ?? null,
          correlationId,
          createdByPlatformUserId: claims.sub,
        },
      });
      this.maybeInjectFailure('after_workflow_row_creation');
      await this.completeCheckpoints(client, id, [
        'request_accepted',
        'validation_completed',
      ]);
      await this.idempotency.completeInTransaction(client, {
        actorId: claims.sub,
        operation: 'CREATE_PROVISIONING_REQUEST',
        idempotencyKey: key,
        requestHash,
        resultResourceType: 'provisioningRequest',
        resultResourceId: id,
      });
      this.maybeInjectFailure('after_idempotency_completion_staging');
      await this.writeAuditInTransaction(
        client,
        claims,
        'tenant_provisioning.request.created',
        id,
        {
          onboardingType: body.onboardingType,
          facilityTypeKey: body.facilityTypeKey,
        },
        null,
        correlationId,
      );
      this.maybeInjectFailure('before_transaction_commit');
    });

    if (replayResourceId) {
      return this.getProgress(claims, replayResourceId);
    }

    this.maybeInjectFailure('after_audit_staging');

    return this.getProgress(claims, id);
  }

  async listRequests(
    claims: JwtClaimsVO,
    query: { limit?: number; cursor?: string },
  ): Promise<{ items: ProvisioningProgressDto[]; nextCursor: string | null }> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.view);
    const limit = Math.min(Math.max(query.limit ?? 20, 1), 50);
    const salesOnly = await this.isSalesTrialOnly(claims);

    const rows = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.findMany({
        where: {
          ...(salesOnly ? { createdByPlatformUserId: claims.sub } : {}),
          ...(query.cursor ? { id: { lt: query.cursor } } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: limit + 1,
        include: { checkpoints: true },
      }),
    );
    const page = rows.slice(0, limit);
    return {
      items: page.map((r) => this.toDto(r)),
      nextCursor: rows.length > limit ? page[page.length - 1]!.id : null,
    };
  }

  async getProgress(claims: JwtClaimsVO, requestId: string): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'readHeavy');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.view);
    const row = await this.loadRequest(requestId);
    const salesOnly = await this.isSalesTrialOnly(claims);
    if (salesOnly && row.createdByPlatformUserId !== claims.sub) {
      throw new ForbiddenException('Unrelated provisioning request.');
    }
    return this.toDto(row);
  }

  async start(
    claims: JwtClaimsVO,
    requestId: string,
    body: { expectedRowVersion: number },
    idempotencyKey?: string,
  ): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.execute);
    this.assertExpectedRowVersion(body?.expectedRowVersion);

    const key = idempotencyKey ?? `start:${requestId}:${body.expectedRowVersion}`;
    const requestHash = this.idempotency.fingerprint({
      op: 'START_PROVISIONING',
      requestId,
      expectedRowVersion: body.expectedRowVersion,
    });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: 'START_PROVISIONING',
      idempotencyKey: key,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return this.getProgress(claims, gate.resultResourceId);
    }

    try {
      await this.runStartPipeline(claims, requestId, body.expectedRowVersion);
      await this.prisma.withPlatformBypass(async (client) => {
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'START_PROVISIONING',
          idempotencyKey: key,
          requestHash,
          resultResourceType: 'provisioningRequest',
          resultResourceId: requestId,
        });
        await this.writeAuditInTransaction(
          client,
          claims,
          'tenant_provisioning.started',
          requestId,
          {},
          null,
        );
      });
    } catch (err) {
      const replay = await this.idempotency.awaitEquivalentReplay({
        actorId: claims.sub,
        operation: 'START_PROVISIONING',
        idempotencyKey: key,
        requestHash,
      });
      if (replay) {
        return this.getProgress(claims, replay.resultResourceId);
      }
      await this.markRetryable(requestId, err);
      throw err;
    }
    return this.getProgress(claims, requestId);
  }

  async retry(
    claims: JwtClaimsVO,
    requestId: string,
    body: { expectedRowVersion: number },
    idempotencyKey?: string,
  ): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.retry);
    await this.requireFreshStepUp(claims);
    this.assertExpectedRowVersion(body?.expectedRowVersion);

    const row = await this.loadRequest(requestId);
    if (row.status !== 'FAILED_RETRYABLE' && row.status !== 'PROVISIONING' && row.status !== 'AWAITING_ACTIVATION') {
      throw new TenantProvisioningError('invalid_retry_state', 'Request is not retryable.', 409);
    }

    const key = idempotencyKey ?? `retry:${requestId}:${body.expectedRowVersion}`;
    const requestHash = this.idempotency.fingerprint({
      op: 'RETRY_PROVISIONING',
      requestId,
      expectedRowVersion: body.expectedRowVersion,
    });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: 'RETRY_PROVISIONING',
      idempotencyKey: key,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return this.getProgress(claims, gate.resultResourceId);
    }

    try {
      if (row.status === 'AWAITING_ACTIVATION' || (await this.checkpointDone(requestId, 'administrator_invitation_prepared'))) {
        // Resume toward activation barrier only via activate; retry re-runs incomplete start steps.
        if (!(await this.checkpointDone(requestId, 'administrator_invitation_prepared'))) {
          await this.runStartPipeline(claims, requestId, body.expectedRowVersion, true);
        }
      } else {
        await this.runStartPipeline(claims, requestId, body.expectedRowVersion, true);
      }
      await this.prisma.withPlatformBypass(async (client) => {
        await this.idempotency.completeInTransaction(client, {
          actorId: claims.sub,
          operation: 'RETRY_PROVISIONING',
          idempotencyKey: key,
          requestHash,
          resultResourceType: 'provisioningRequest',
          resultResourceId: requestId,
        });
        await this.writeAuditInTransaction(
          client,
          claims,
          'tenant_provisioning.retried',
          requestId,
          {},
          null,
        );
      });
    } catch (err) {
      await this.markRetryable(requestId, err);
      throw err;
    }
    return this.getProgress(claims, requestId);
  }

  async compensate(
    claims: JwtClaimsVO,
    requestId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
  ): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.compensate);
    await this.requireFreshStepUp(claims);
    this.assertExpectedRowVersion(body?.expectedRowVersion);
    if (!body.reason?.trim() || body.reason.trim().length < 3) {
      throw new TenantProvisioningError('reason_required', 'Compensation reason is required.', 400);
    }

    const key = idempotencyKey ?? `compensate:${requestId}:${body.expectedRowVersion}`;
    const requestHash = this.idempotency.fingerprint({
      op: 'COMPENSATE_PROVISIONING',
      requestId,
      expectedRowVersion: body.expectedRowVersion,
      reason: body.reason.trim(),
    });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: 'COMPENSATE_PROVISIONING',
      idempotencyKey: key,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return this.getProgress(claims, gate.resultResourceId);
    }

    const row = await this.loadRequest(requestId);
    this.assertRowVersion(row.rowVersion, body.expectedRowVersion);
    if (row.status === 'COMPLETED') {
      throw new TenantProvisioningError('cannot_compensate_completed', 'Completed workflows cannot be compensated.', 409);
    }

    this.maybeInjectFailure('compensation_failure');

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformTenantProvisioningRequest.update({
        where: { id: requestId },
        data: { status: 'COMPENSATING', rowVersion: { increment: 1 } },
      });
    });

    if (row.invitationId && !row.invitationDispatchedAt) {
      await this.invitations.compensate(row.invitationId);
    }

    // Mark workflow-owned module flags unavailable when we created them
    if (row.tenantId) {
      const owned = await this.prisma.withPlatformBypass((c) =>
        c.platformTenantProvisioningOwnedResource.findMany({
          where: { requestId, provenance: 'CREATED_BY_WORKFLOW', safeToCompensate: true },
        }),
      );
      for (const res of owned) {
        if (res.resourceType === 'tenant_features') {
          await this.prisma.withPlatformBypass((c) =>
            c.tenant.update({
              where: { id: row.tenantId! },
              data: {
                features: {
                  provisioningCompensated: true,
                  facilityTypeKey: null,
                  specialtyKeys: [],
                  moduleFlags: {},
                },
              },
            }),
          );
        }
      }
    }

    await this.prisma.withPlatformBypass(async (client) => {
      await client.platformTenantProvisioningRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPENSATED',
          lastErrorCode: 'compensated',
          reservedSlug: null,
          rowVersion: { increment: 1 },
        },
      });
      await this.idempotency.completeInTransaction(client, {
        actorId: claims.sub,
        operation: 'COMPENSATE_PROVISIONING',
        idempotencyKey: key,
        requestHash,
        resultResourceType: 'provisioningRequest',
        resultResourceId: requestId,
      });
      await this.writeAuditInTransaction(
        client,
        claims,
        'tenant_provisioning.compensated',
        requestId,
        { reason: body.reason.trim().slice(0, 200) },
        row.tenantId,
      );
    });

    return this.getProgress(claims, requestId);
  }

  async activate(
    claims: JwtClaimsVO,
    requestId: string,
    body: { expectedRowVersion: number; reason: string },
    idempotencyKey?: string,
  ): Promise<ProvisioningProgressDto> {
    this.assertEnabled();
    this.rateLimit.enforce(claims.sub, 'highImpact');
    await this.assertHasPermission(claims, PROVISION_PERMISSIONS.activate);
    await this.requireFreshStepUp(claims);
    this.assertExpectedRowVersion(body?.expectedRowVersion);
    if (!body.reason?.trim()) {
      throw new TenantProvisioningError('reason_required', 'Activation reason is required.', 400);
    }

    const key = idempotencyKey ?? `activate:${requestId}:${body.expectedRowVersion}`;
    const requestHash = this.idempotency.fingerprint({
      op: 'FINALIZE_ONBOARDING_ACTIVATION',
      requestId,
      expectedRowVersion: body.expectedRowVersion,
    });
    const gate = await this.idempotency.beginOrReplay({
      actorId: claims.sub,
      operation: 'FINALIZE_ONBOARDING_ACTIVATION',
      idempotencyKey: key,
      requestHash,
    });
    if (gate.kind === 'replay') {
      return this.getProgress(claims, gate.resultResourceId);
    }

    const already = await this.loadRequest(requestId);
    if (already.status === 'COMPLETED') {
      return this.getProgress(claims, requestId);
    }

    try {
      await this.runActivationBarrier(claims, requestId, body, { key, requestHash });
    } catch (err) {
      const replay = await this.idempotency.awaitEquivalentReplay({
        actorId: claims.sub,
        operation: 'FINALIZE_ONBOARDING_ACTIVATION',
        idempotencyKey: key,
        requestHash,
      });
      if (replay) {
        return this.getProgress(claims, replay.resultResourceId);
      }
      await this.markRetryable(requestId, err);
      throw err;
    }
    // F31 — post-commit crash before client ack. Must run after try/catch so a
    // completed idempotency record cannot swallow the injected failure via replay.
    this.maybeInjectFailure('worker_crash_after_commit_before_ack');
    return this.getProgress(claims, requestId);
  }

  // ─── pipelines ─────────────────────────────────────────────────────────────

  private async runStartPipeline(
    claims: JwtClaimsVO,
    requestId: string,
    expectedRowVersion: number,
    isRetry = false,
  ): Promise<void> {
    let row = await this.loadRequest(requestId);
    if (!isRetry && row.status !== 'READY' && row.status !== 'FAILED_RETRYABLE') {
      throw new TenantProvisioningError('invalid_start_state', 'Request is not ready to start.', 409);
    }

    const input = this.rowToInput(row);
    const validated = await this.validation.validate(input, {
      excludeRequestId: requestId,
      excludeTenantId: row.tenantId ?? undefined,
    });
    if (!validated.valid || validated.previewFingerprint !== row.previewFingerprint) {
      throw new TenantProvisioningError('stale_preview', 'Preview fingerprint mismatch or validation failed.', 409);
    }

    const claimed = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.updateMany({
        where: {
          id: requestId,
          rowVersion: expectedRowVersion,
          ...(isRetry
            ? { status: { in: ['FAILED_RETRYABLE', 'PROVISIONING', 'AWAITING_ACTIVATION'] } }
            : { status: { in: ['READY', 'FAILED_RETRYABLE'] } }),
        },
        data: { status: 'PROVISIONING', lastErrorCode: null, rowVersion: { increment: 1 } },
      }),
    );
    if (claimed.count !== 1) {
      throw new ConflictException({
        code: 'row_version_conflict',
        message: 'Expected rowVersion does not match or start already claimed.',
      });
    }
    row = await this.loadRequest(requestId);

    // Tenant identity
    if (!(await this.checkpointDone(requestId, 'tenant_registry_created'))) {
      const slug =
        row.reservedSlug ??
        this.validation.normalizeSlug(row.organizationName) ??
        `t-${requestId.replace(/-/g, '').slice(0, 12)}`;

      await this.markCheckpoint(requestId, 'tenant_identity_reserved');
      this.maybeInjectFailure('after_tenant_slug_reservation');

      const { tenantId } = await this.createTenant.execute(
        new CreateTenantCommand(row.organizationName, undefined, row.timezone ?? 'UTC'),
      );

      await this.prisma.withPlatformBypass(async (c) => {
        const conflict = await c.tenant.findFirst({
          where: { slug, id: { not: tenantId }, deletedAt: null },
        });
        if (conflict) {
          throw new ConflictException({ code: 'slug_conflict', message: 'Slug already taken.' });
        }
        await c.tenant.update({
          where: { id: tenantId },
          data: {
            slug,
            status: 'SUSPENDED',
            lifecycleStatus: 'TRIAL',
            features: {
              facilityTypeKey: row.facilityTypeKey,
              specialtyKeys: row.specialtyKeys,
              moduleFlags: Object.fromEntries(
                (validated.derivedModuleKeys ?? []).map((k) => [k, true]),
              ),
              provisioningRequestId: requestId,
            },
          },
        });

        const planTier = planKeyToLegacyTier(validated.planKey);
        const domainRegion = resolveDomainRegion(row.region);
        const platformTenant = PlatformTenant.provision({
          tenantId,
          displayName: row.organizationName,
          region: domainRegion,
          plan: planTier,
          provisionedBy: claims.sub,
        });

        await c.platformTenant.create({
          data: {
            id: platformTenant.id,
            tenantId,
            displayName: platformTenant.displayName,
            region: domainRegionToPrisma(domainRegion),
            plan: (planTier === 'enterprise'
              ? 'ENTERPRISE'
              : planTier === 'growth'
                ? 'PRO'
                : 'LITE') as never,
            status: 'PROVISIONING',
            provisionedBy: claims.sub,
            maxBranches: platformTenant.plan.limits.maxBranches,
            maxUsers: platformTenant.plan.limits.maxUsers,
          },
        });
        await c.platformTenantProvisioningRequest.update({
          where: { id: requestId },
          data: {
            tenantId,
            platformTenantId: platformTenant.id,
            rowVersion: { increment: 1 },
          },
        });
        await this.recordOwned(c, requestId, 'tenant', tenantId);
        await this.recordOwned(c, requestId, 'platform_tenant', platformTenant.id);
        await this.recordOwned(c, requestId, 'tenant_features', tenantId);
        await this.completeCheckpoints(c, requestId, [
          'tenant_registry_created',
          'initial_tenant_configuration_created',
          'facility_type_assigned',
          'specialties_assigned',
          'tenant_resources_provisioned',
          'enabled_modules_provisioned',
          'initial_limit_integration_completed',
        ]);
      });

      // Ordered inject points after durable registry TX (F05–F16).
      this.maybeInjectFailure('after_tenant_registry');
      this.maybeInjectFailure('after_initial_tenant_settings');
      this.maybeInjectFailure('after_facility_assignment');
      this.maybeInjectFailure('after_specialty_assignment');
      this.maybeInjectFailure('during_first_module_provisioning');
      this.maybeInjectFailure('after_partial_module_provisioning');
      this.maybeInjectFailure('after_module_provisioning_completion');
      this.maybeInjectFailure('during_initial_limit_integration');
      this.maybeInjectFailure('during_u01_initialization');
      row = await this.loadRequest(requestId);
    }

    // Commercial configuration via Step 16 services
    if (!(await this.checkpointDone(requestId, 'commercial_configuration_prepared'))) {
      let afterAddOns: { id: string; rowVersion: number };

      if (row.commercialConfigId) {
        const existing = await this.prisma.withPlatformBypass((c) =>
          c.platformSubscriptionCommercialConfig.findUnique({
            where: { id: row.commercialConfigId! },
          }),
        );
        if (!existing) {
          throw new NotFoundException('Commercial configuration missing for resume.');
        }
        afterAddOns = { id: existing.id, rowVersion: existing.rowVersion };
      } else {
        const created = await this.subscriptions.create(
          claims,
          { platformTenantId: row.platformTenantId! },
          `prov-create-${requestId}`,
          { provisioningAuthority: true },
        );
        const assigned = await this.subscriptions.assignPlanVersion(
          claims,
          created.id,
          {
            expectedRowVersion: created.rowVersion,
            planVersionId: row.publishedPlanVersionId,
          },
          `prov-plan-${requestId}`,
          { provisioningAuthority: true },
        );

        const addOnIds = (row.addOnSelections as Array<{ addOnId: string }>) ?? [];
        afterAddOns = assigned;
        if (addOnIds.length) {
          const versionIds: string[] = [];
          for (const a of addOnIds) {
            const ver = await this.prisma.withPlatformBypass((c) =>
              c.platformAddOnVersion.findFirst({
                where: { addOnId: a.addOnId, lifecycle: 'PUBLISHED' },
                orderBy: { createdAt: 'desc' },
              }),
            );
            if (ver) versionIds.push(ver.id);
          }
          if (versionIds.length) {
            afterAddOns = await this.subscriptions.replaceAddOns(
              claims,
              assigned.id,
              { expectedRowVersion: assigned.rowVersion, addOnVersionIds: versionIds },
              `prov-addons-${requestId}`,
              { provisioningAuthority: true },
            );
          }
        }
        // Persist commercial id before failure injection so retry can resume without re-assign.
        await this.prisma.withPlatformBypass((c) =>
          c.platformTenantProvisioningRequest.update({
            where: { id: requestId },
            data: { commercialConfigId: afterAddOns.id, rowVersion: { increment: 1 } },
          }),
        );
        row = await this.loadRequest(requestId);
        this.maybeInjectFailure('after_addon_assignment');
      }

      this.maybeInjectFailure('after_commercial_configuration');

      await this.subscriptions.preview(claims, afterAddOns.id, {
        provisioningAuthority: true,
      });

      await this.prisma.withPlatformBypass(async (c) => {
        await c.platformTenantProvisioningRequest.update({
          where: { id: requestId },
          data: {
            commercialConfigId: afterAddOns.id,
            rowVersion: { increment: 1 },
          },
        });
        await this.recordOwned(c, requestId, 'commercial_config', afterAddOns.id);
        await this.completeCheckpoints(c, requestId, [
          'commercial_configuration_prepared',
          'add_ons_assigned',
          'entitlement_preview_frozen',
        ]);
      });
      this.maybeInjectFailure('after_entitlement_preview_persistence');
      row = await this.loadRequest(requestId);
    }

    // Invitation prepare (no email)
    if (!(await this.checkpointDone(requestId, 'administrator_invitation_prepared'))) {
      const prepared = await this.invitations.prepare({
        tenantId: row.tenantId!,
        email: row.adminEmail,
        displayName: row.adminDisplayName ?? undefined,
        invitedBy: claims.sub,
      });
      await this.prisma.withPlatformBypass(async (c) => {
        await c.platformTenantProvisioningRequest.update({
          where: { id: requestId },
          data: {
            invitationId: prepared.invitationId,
            invitationPreparedAt: new Date(),
            status: 'AWAITING_ACTIVATION',
            rowVersion: { increment: 1 },
          },
        });
        await this.recordOwned(c, requestId, 'staff_invitation', prepared.invitationId);
        await this.completeCheckpoints(c, requestId, ['administrator_invitation_prepared']);
      });
      this.maybeInjectFailure('after_invitation_prepare');
    } else {
      await this.prisma.withPlatformBypass((c) =>
        c.platformTenantProvisioningRequest.update({
          where: { id: requestId },
          data: { status: 'AWAITING_ACTIVATION', rowVersion: { increment: 1 } },
        }),
      );
    }
  }

  private async runActivationBarrier(
    claims: JwtClaimsVO,
    requestId: string,
    body: { expectedRowVersion: number; reason: string },
    idem: { key: string; requestHash: string },
  ): Promise<void> {
    const claimed = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.updateMany({
        where: {
          id: requestId,
          rowVersion: body.expectedRowVersion,
          status: { in: ['AWAITING_ACTIVATION', 'FAILED_RETRYABLE'] },
        },
        data: { rowVersion: { increment: 1 } },
      }),
    );
    if (claimed.count !== 1) {
      throw new ConflictException({
        code: 'row_version_conflict',
        message: 'Expected rowVersion does not match or activation already claimed.',
      });
    }
    const fresh = await this.loadRequest(requestId);
    if (fresh.status === 'COMPLETED') {
      return;
    }
    if (fresh.status !== 'AWAITING_ACTIVATION' && fresh.status !== 'FAILED_RETRYABLE') {
      throw new TenantProvisioningError('invalid_activation_state', 'Not awaiting activation.', 409);
    }
    if (!fresh.commercialConfigId || !fresh.platformTenantId || !fresh.tenantId || !fresh.invitationId) {
      throw new TenantProvisioningError('activation_prerequisites', 'Activation prerequisites incomplete.', 409);
    }

    // Revalidate preview freshness
    const validated = await this.validation.validate(this.rowToInput(fresh), {
      excludeRequestId: requestId,
      excludeTenantId: fresh.tenantId ?? undefined,
    });
    if (!validated.valid) {
      throw new TenantProvisioningError('stale_preview', 'Validation no longer passes.', 409);
    }

    await this.markCheckpoint(requestId, 'activation_prerequisites_confirmed');

    if (!(await this.checkpointDone(requestId, 'commercial_activation_completed'))) {
      this.maybeInjectFailure('before_commercial_activation');
      const cfg = await this.prisma.withPlatformBypass((c) =>
        c.platformSubscriptionCommercialConfig.findUnique({ where: { id: fresh.commercialConfigId! } }),
      );
      if (!cfg) throw new NotFoundException('Commercial configuration missing.');
      if (cfg.lifecycle !== 'ACTIVE_COMMERCIAL') {
        await this.subscriptions.activate(
          claims,
          fresh.commercialConfigId,
          { expectedRowVersion: cfg.rowVersion, reason: body.reason },
          `prov-activate-${requestId}`,
          { provisioningAuthority: true },
        );
      }
      this.maybeInjectFailure('after_commercial_activation');
      this.maybeInjectFailure('after_activation_snapshot_creation');
      await this.markCheckpoint(requestId, 'commercial_activation_completed');
    }

    if (!(await this.checkpointDone(requestId, 'eer_verification_completed'))) {
      this.maybeInjectFailure('during_eer_verification');
      await this.eer.invalidateTenant(fresh.tenantId!);
      const bundle = await this.eer.resolveEffectiveEntitlements(fresh.tenantId!);
      if (!bundle || (bundle as { source?: string }).source === 'LEGACY') {
        const pt = await this.prisma.withPlatformBypass((c) =>
          c.platformTenant.findUnique({ where: { id: fresh.platformTenantId! } }),
        );
        const snap = await this.prisma.withPlatformBypass((c) =>
          c.platformSubscriptionCommercialSnapshot.findFirst({
            where: { configId: fresh.commercialConfigId! },
          }),
        );
        if (!snap) {
          throw new TenantProvisioningError('eer_verification_failed', 'Activation snapshot missing for EER.', 409);
        }
        if ((bundle as { source?: string }).source === 'LEGACY' && pt?.status === 'PROVISIONING') {
          const resolved = await this.eer.resolveEffectiveEntitlements(fresh.tenantId!);
          if ((resolved as { source?: string }).source === 'LEGACY' && !snap) {
            throw new TenantProvisioningError('eer_legacy_forbidden', 'Managed onboarding must not use Legacy.', 409);
          }
        }
      }
      this.maybeInjectFailure('after_eer_verification');
      await this.markCheckpoint(requestId, 'eer_verification_completed');
    }

    if (!(await this.checkpointDone(requestId, 'tenant_onboarding_activation_completed'))) {
      this.maybeInjectFailure('before_tenant_activation');
      await this.prisma.withPlatformBypass(async (c) => {
        await c.platformTenant.update({
          where: { id: fresh.platformTenantId! },
          data: {
            status: 'ACTIVE',
            activatedAt: new Date(),
            // Flexible Step 19 — keep PlatformTenant.rowVersion in lockstep with status writes
            rowVersion: { increment: 1 },
          },
        });
        await c.tenant.update({
          where: { id: fresh.tenantId! },
          data: { status: 'ACTIVE', lifecycleStatus: 'ACTIVE' },
        });
        await c.user.updateMany({
          where: { tenantId: fresh.tenantId!, email: fresh.adminEmail },
          data: { isActive: true },
        });
      });
      this.maybeInjectFailure('after_tenant_activation');
      await this.markCheckpoint(requestId, 'tenant_onboarding_activation_completed');
    }

    if (!(await this.checkpointDone(requestId, 'administrator_invitation_dispatched'))) {
      this.maybeInjectFailure('before_invitation_dispatch');
      await this.invitations.dispatch(fresh.invitationId!);
      await this.prisma.withPlatformBypass((c) =>
        c.platformTenantProvisioningRequest.update({
          where: { id: requestId },
          data: { invitationDispatchedAt: new Date(), rowVersion: { increment: 1 } },
        }),
      );
      this.maybeInjectFailure('after_invitation_dispatch');
      await this.markCheckpoint(requestId, 'administrator_invitation_dispatched');
    }

    this.maybeInjectFailure('before_workflow_completion');
    await this.prisma.withPlatformBypass(async (c) => {
      await c.platformTenantProvisioningRequest.update({
        where: { id: requestId },
        data: {
          status: 'COMPLETED',
          activatedAt: new Date(),
          completedAt: new Date(),
          rowVersion: { increment: 1 },
        },
      });
      await this.completeCheckpoints(c, requestId, ['workflow_completed']);
      // Step 21 A11 — idempotency completion and the durable success audit
      // commit atomically with the COMPLETED status write (Model A). The
      // worker-crash injection point below simulates a post-commit crash,
      // so by the time it fires, both are already durable together.
      await this.idempotency.completeInTransaction(c, {
        actorId: claims.sub,
        operation: 'FINALIZE_ONBOARDING_ACTIVATION',
        idempotencyKey: idem.key,
        requestHash: idem.requestHash,
        resultResourceType: 'provisioningRequest',
        resultResourceId: requestId,
      });
      await this.writeAuditInTransaction(
        c,
        claims,
        'tenant_provisioning.activated',
        requestId,
        { reason: body.reason.trim().slice(0, 200) },
        null,
      );
    });
    // F31 inject must run in activate() after try/catch — not here — otherwise
    // awaitEquivalentReplay swallows the post-commit crash once idempotency is completed.
  }

  // ─── helpers ───────────────────────────────────────────────────────────────

  private async loadRequest(requestId: string) {
    const row = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.findUnique({
        where: { id: requestId },
        include: { checkpoints: true },
      }),
    );
    if (!row) throw new NotFoundException('Provisioning request not found.');
    return row;
  }

  private rowToInput(row: {
    organizationName: string;
    requestedSlug: string | null;
    region: string | null;
    timezone: string | null;
    facilityTypeKey: string;
    specialtyKeys: unknown;
    publishedPlanVersionId: string;
    addOnSelections: unknown;
    adminEmail: string;
    adminDisplayName: string | null;
    adminLocale: string | null;
    onboardingType: string;
    requestedStartAt: Date | null;
    salesAttributionId: string | null;
    externalRequestId: string | null;
  }): TenantProvisioningRequestInput {
    return {
      organization: {
        legalOrDisplayName: row.organizationName,
        requestedSlug: row.requestedSlug ?? undefined,
        regionOrEnvironment: row.region ?? undefined,
        timezone: row.timezone ?? undefined,
      },
      facilityTypeKey: row.facilityTypeKey,
      specialtyKeys: Array.isArray(row.specialtyKeys) ? (row.specialtyKeys as string[]) : [],
      publishedPlanVersionId: row.publishedPlanVersionId,
      addOnSelections: Array.isArray(row.addOnSelections)
        ? (row.addOnSelections as TenantProvisioningRequestInput['addOnSelections'])
        : [],
      tenantAdmin: {
        email: row.adminEmail,
        displayName: row.adminDisplayName ?? undefined,
        locale: row.adminLocale ?? undefined,
      },
      onboardingType: row.onboardingType as OnboardingType,
      requestedStartAt: row.requestedStartAt?.toISOString(),
      salesAttributionId: row.salesAttributionId ?? undefined,
      externalRequestId: row.externalRequestId ?? undefined,
    };
  }

  private toDto(row: {
    id: string;
    status: string;
    rowVersion: number;
    organizationName: string;
    facilityTypeKey: string;
    specialtyKeys: unknown;
    publishedPlanVersionId: string;
    onboardingType: string;
    tenantId: string | null;
    platformTenantId: string | null;
    commercialConfigId: string | null;
    previewFingerprint: string | null;
    lastErrorCode: string | null;
    createdAt: Date;
    updatedAt: Date;
    checkpoints?: Array<{ checkpointKey: string; status: string; completedAt: Date | null }>;
  }): ProvisioningProgressDto {
    return {
      id: row.id,
      status: row.status as ProvisioningStatus,
      rowVersion: row.rowVersion,
      organizationName: row.organizationName,
      facilityTypeKey: row.facilityTypeKey,
      specialtyKeys: Array.isArray(row.specialtyKeys) ? (row.specialtyKeys as string[]) : [],
      publishedPlanVersionId: row.publishedPlanVersionId,
      onboardingType: row.onboardingType as OnboardingType,
      tenantId: row.tenantId,
      platformTenantId: row.platformTenantId,
      commercialConfigId: row.commercialConfigId,
      previewFingerprint: row.previewFingerprint,
      lastErrorCode: row.lastErrorCode,
      checkpoints: (row.checkpoints ?? []).map((c) => ({
        key: c.checkpointKey,
        status: c.status,
        completedAt: c.completedAt?.toISOString() ?? null,
      })),
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  private async checkpointDone(requestId: string, key: ProvisioningCheckpointKey): Promise<boolean> {
    const row = await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningCheckpoint.findUnique({
        where: { requestId_checkpointKey: { requestId, checkpointKey: key } },
      }),
    );
    return row?.status === 'COMPLETED';
  }

  private async markCheckpoint(requestId: string, key: ProvisioningCheckpointKey): Promise<void> {
    await this.prisma.withPlatformBypass((c) => this.completeCheckpoints(c, requestId, [key]));
  }

  private async completeCheckpoints(
    // Transaction / Prisma client — intentionally loose for TX + wrapper compatibility.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    requestId: string,
    keys: ProvisioningCheckpointKey[],
  ): Promise<void> {
    for (const checkpointKey of keys) {
      await client.platformTenantProvisioningCheckpoint.upsert({
        where: { requestId_checkpointKey: { requestId, checkpointKey } },
        create: {
          id: randomUUID(),
          requestId,
          checkpointKey,
          status: 'COMPLETED',
          completedAt: new Date(),
        },
        update: { status: 'COMPLETED', completedAt: new Date() },
      });
    }
  }

  private async recordOwned(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    client: any,
    requestId: string,
    resourceType: string,
    resourceId: string,
  ): Promise<void> {
    await client.platformTenantProvisioningOwnedResource.upsert({
      where: {
        requestId_resourceType_resourceId: { requestId, resourceType, resourceId },
      },
      create: {
        id: randomUUID(),
        requestId,
        resourceType,
        resourceId,
        provenance: 'CREATED_BY_WORKFLOW',
        safeToCompensate: true,
      },
      update: {},
    });
  }

  private assertExpectedRowVersion(expected: unknown): asserts expected is number {
    if (typeof expected !== 'number' || !Number.isInteger(expected) || expected < 0) {
      throw new TenantProvisioningError('row_version_required', 'expectedRowVersion is required.', 400);
    }
  }

  private assertRowVersion(actual: number, expected: number): void {
    if (actual !== expected) {
      throw new ConflictException({
        code: 'row_version_conflict',
        message: 'Expected rowVersion does not match.',
      });
    }
  }

  private async markRetryable(requestId: string, err: unknown): Promise<void> {
    const code =
      err instanceof TenantProvisioningError
        ? err.code
        : err instanceof ConflictException
          ? 'conflict'
          : 'provisioning_failed';
    await this.prisma.withPlatformBypass((c) =>
      c.platformTenantProvisioningRequest.updateMany({
        where: {
          id: requestId,
          status: { notIn: ['COMPLETED', 'COMPENSATED', 'FAILED_TERMINAL'] },
        },
        data: {
          status: 'FAILED_RETRYABLE',
          lastErrorCode: code.slice(0, 64),
          rowVersion: { increment: 1 },
        },
      }),
    );
  }

  private maybeInjectFailure(point: string): void {
    if (process.env.NODE_ENV === 'production') return;
    if (process.env[PROVISIONING_FAILURE_INJECTION_ENV] === point) {
      throw new TenantProvisioningError('injected_failure', `Injected failure at ${point}`, 500);
    }
  }

  private async permissions(claims: JwtClaimsVO): Promise<Set<string>> {
    return new Set(await this.authorization.resolveEffectivePermissions(claims.sub));
  }

  private async assertHasPermission(claims: JwtClaimsVO, key: string): Promise<void> {
    const perms = await this.permissions(claims);
    if (!perms.has(key)) {
      throw new ForbiddenException(`Missing ${key} permission.`);
    }
  }

  private async isSalesTrialOnly(claims: JwtClaimsVO): Promise<boolean> {
    const perms = await this.permissions(claims);
    return (
      perms.has('sales-trial.create') &&
      !perms.has(PROVISION_PERMISSIONS.create) &&
      !perms.has(PROVISION_PERMISSIONS.execute)
    );
  }

  private async assertCanValidate(claims: JwtClaimsVO): Promise<void> {
    const perms = await this.permissions(claims);
    if (
      !perms.has(PROVISION_PERMISSIONS.view) &&
      !perms.has(PROVISION_PERMISSIONS.create) &&
      !perms.has('sales-trial.create')
    ) {
      throw new ForbiddenException('Missing tenant.provision.view permission.');
    }
  }

  private async assertCanCreate(
    claims: JwtClaimsVO,
    onboardingType: OnboardingType,
    salesTrialOnly: boolean,
  ): Promise<void> {
    const perms = await this.permissions(claims);
    if (perms.has(PROVISION_PERMISSIONS.create)) return;
    if (salesTrialOnly && onboardingType === 'TRIAL_REQUEST' && perms.has('sales-trial.create')) {
      return;
    }
    throw new ForbiddenException('Missing tenant.provision.create permission.');
  }

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    const sessionId = claims.sessionId;
    if (!sessionId) throw new ForbiddenException('Fresh step-up required.');
    const session = await this.refreshRepo.findBySessionId(sessionId);
    if (!session) throw new ForbiddenException('Fresh step-up required.');
    await this.assurance.requireStepUp(session as never);
  }

  /**
   * Step 21 A11 — durable success AuditEntry append (Model A). Must be
   * invoked with the same open transaction client as the business mutation
   * it documents; throws on failure so the transaction rolls back together
   * with the mutation rather than silently losing the audit trail.
   */
  private async writeAuditInTransaction(
    client: AuditTxClient,
    claims: JwtClaimsVO,
    action: string,
    resourceId: string,
    details: Record<string, string>,
    tenantId: string | null,
    correlationSource?: string | null,
  ): Promise<void> {
    const roles = (claims.roles as unknown as string[] | undefined)?.filter(Boolean) ?? [];
    const correlationId = resolveOperationCorrelationId({ explicit: correlationSource ?? null });
    await this.auditLog.recordInTransaction(client, {
      tenantId: tenantId ?? PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      action,
      resourceId,
      actorId: claims.sub,
      actorRoles: roles.length > 0 ? roles : ['platform'],
      correlationId,
      descriptionEn: action,
      descriptionAr: action,
      details,
    });
  }
}

/** Expose checkpoint catalog for tests/docs. */
export const TENANT_PROVISIONING_CHECKPOINT_CATALOG = PROVISIONING_CHECKPOINTS;
