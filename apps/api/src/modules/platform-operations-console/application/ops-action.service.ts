import { ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PLATFORM_REFRESH_TOKEN_REPOSITORY } from '../../auth/platform-auth.tokens';
import type { PlatformRefreshTokenRepository } from '../../auth/domain/repositories/platform-refresh-token.repository.interface';
import { TenantProvisioningService } from '../../tenant-provisioning/application/tenant-provisioning.service';
import { EffectiveEntitlementRuntimeService } from '../../effective-entitlement-runtime/application/effective-entitlement-runtime.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import {
  OPERATIONS_CONSOLE_ACTIONS,
  OPERATIONS_CONSOLE_PERMISSIONS,
  isOperationsConsoleFailureInjectionActive,
} from '../platform-operations-console.constants';
import { OpsConsoleError, type OpsActionResult } from '../domain/operations-console.types';
import { OpsIdempotencyService } from './ops-idempotency.service';
import {
  OpsDurableIdempotencyService,
  OpsIdempotencyEquivalentRaceLostError,
} from './ops-durable-idempotency.service';
import { OpsRateLimitService } from './ops-rate-limit.service';
import { OpsAuditLog } from './ops-audit.log';
import { OpsQueryService } from './ops-query.service';
import { resolveOperationCorrelationId } from '../../platform-audit-center/application/operation-correlation';

/**
 * Flexible Step 22 actions.
 * - Provisioning retry: D-A source via TenantProvisioningService.retry + D-B ops claim for HTTP/audit.
 * - Cache invalidate: D-B PlatformOperationsIdempotencyRecord (no delegated request identity).
 * Process-local Map is optimization only — never sole authority.
 * Durable pending claim is acquired before material source effects.
 */
@Injectable()
export class OpsActionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly processCache: OpsIdempotencyService,
    private readonly durable: OpsDurableIdempotencyService,
    private readonly rateLimit: OpsRateLimitService,
    private readonly audit: OpsAuditLog,
    private readonly query: OpsQueryService,
    private readonly assurance: PlatformAssuranceService,
    @Inject(PLATFORM_REFRESH_TOKEN_REPOSITORY)
    private readonly platformSessions: PlatformRefreshTokenRepository,
    @Optional() private readonly provisioning?: TenantProvisioningService,
    @Optional() private readonly eer?: EffectiveEntitlementRuntimeService,
  ) {}

  private async requireFreshStepUp(claims: JwtClaimsVO): Promise<void> {
    if (isOperationsConsoleFailureInjectionActive('step_up_validation')) {
      throw new ForbiddenException({
        code: 'PLATFORM_STEP_UP_REQUIRED',
        message: 'Step-up verification is required for this action.',
      });
    }
    if (!claims.sessionId) throw new ForbiddenException('Fresh step-up required.');
    const session = await this.platformSessions.findBySessionId(claims.sessionId);
    if (!session) throw new ForbiddenException('Fresh step-up required.');
    this.assurance.requireStepUp(session);
  }

  private warmProcessCache(
    cacheKey: string,
    actorId: string,
    action: string,
    targetId: string,
    result: OpsActionResult,
  ): void {
    this.processCache.complete(cacheKey, {
      actorId,
      action,
      targetId,
      result: { ...result, replayed: true },
      completedAt: Date.now(),
    });
  }

  async retryProvisioning(
    claims: JwtClaimsVO,
    perms: Set<string>,
    input: {
      requestId: string;
      expectedRowVersion: number;
      reason: string;
      idempotencyKey: string;
    },
  ): Promise<OpsActionResult> {
    if (!perms.has(OPERATIONS_CONSOLE_PERMISSIONS.provisionRetry)) {
      throw new OpsConsoleError('forbidden', 'Missing tenant.provision.retry', 403);
    }
    if (!input.reason?.trim()) {
      throw new OpsConsoleError('reason_required', 'Reason is required', 400);
    }
    if (!input.idempotencyKey?.trim()) {
      throw new OpsConsoleError('idempotency_required', 'Idempotency-Key is required', 400);
    }
    this.rateLimit.assertAllowed(claims.sub, 'provisioning_retry', 10);
    await this.requireFreshStepUp(claims);

    if (isOperationsConsoleFailureInjectionActive('source_state_validation')) {
      throw new OpsConsoleError('conflict', 'Source state conflict', 409);
    }
    if (isOperationsConsoleFailureInjectionActive('provisioning_retry')) {
      throw new OpsConsoleError('injected_failure', 'Injected provisioning retry failure', 500);
    }
    if (!this.provisioning) {
      throw new OpsConsoleError('source_unavailable', 'Provisioning service unavailable', 503);
    }

    const operation = OPERATIONS_CONSOLE_ACTIONS.PROVISIONING_RETRY;
    const requestHash = this.durable.fingerprint({
      op: operation,
      requestId: input.requestId,
      expectedRowVersion: input.expectedRowVersion,
      reason: input.reason.trim(),
    });
    const cacheKey = `ops:prov-retry:${input.idempotencyKey}`;

    const processGate = this.processCache.beginOrReplay(
      cacheKey,
      claims.sub,
      operation,
      input.requestId,
    );
    if (!processGate.proceed) {
      return processGate.replay.result as OpsActionResult;
    }

    const durableGate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      resultResourceType: 'provisioningRequest',
      resultResourceId: input.requestId,
    });
    if (durableGate.kind === 'replay') {
      this.warmProcessCache(cacheKey, claims.sub, operation, input.requestId, durableGate.result);
      return durableGate.result;
    }

    if (isOperationsConsoleFailureInjectionActive('after_idempotency_claim')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected after idempotency claim', 500);
    }
    if (isOperationsConsoleFailureInjectionActive('after_retry_request_staging')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected after retry staging', 500);
    }
    if (isOperationsConsoleFailureInjectionActive('before_commit')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected before commit', 500);
    }
    if (isOperationsConsoleFailureInjectionActive('source_retry_service')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected source retry failure', 500);
    }

    try {
      // D-A: Step 17 durable source idempotency owns provisioning effect.
      const progress = await this.provisioning.retry(
        claims,
        input.requestId,
        { expectedRowVersion: input.expectedRowVersion },
        input.idempotencyKey,
      );

      const correlationId = resolveOperationCorrelationId();
      const result: OpsActionResult = {
        accepted: true,
        replayed: false,
        action: operation,
        targetId: input.requestId,
        correlationId,
        result: 'accepted',
        sourceEffect: 'delegated_to_TenantProvisioningService.retry',
      };

      try {
        await this.prisma.withPlatformBypass(async (client) => {
          await this.durable.completeInTransaction(client, {
            actorId: claims.sub,
            operation,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            resultResourceType: 'provisioningRequest',
            resultResourceId: input.requestId,
            result,
          });
          await this.audit.recordInTransaction(client, {
            action: operation,
            resourceId: input.requestId,
            actorId: claims.sub,
            actorRoles: (claims.roles as unknown as string[]) ?? [],
            reason: input.reason,
            correlationId,
            result: 'success',
            descriptionEn: 'Operations Console requested provisioning retry',
            descriptionAr: 'طلبت وحدة العمليات إعادة محاولة التزويد',
            details: { status: progress.status, sourceEffect: 'delegated_retry' },
          });
        });
      } catch (err) {
        if (err instanceof OpsIdempotencyEquivalentRaceLostError) {
          const replayed = this.durable.payloadToResult(err.resultPayload);
          this.warmProcessCache(cacheKey, claims.sub, operation, input.requestId, replayed);
          return replayed;
        }
        throw err;
      }

      this.warmProcessCache(cacheKey, claims.sub, operation, input.requestId, {
        ...result,
        replayed: true,
      });

      if (isOperationsConsoleFailureInjectionActive('after_commit_before_response')) {
        throw new OpsConsoleError('injected_failure', 'Injected after commit before response', 500);
      }
      return result;
    } catch (err) {
      if (
        err instanceof OpsConsoleError &&
        err.code === 'injected_failure' &&
        isOperationsConsoleFailureInjectionActive('after_commit_before_response')
      ) {
        throw err;
      }
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw err;
    }
  }

  async invalidateEntitlementCache(
    claims: JwtClaimsVO,
    perms: Set<string>,
    input: {
      tenantId: string;
      reason: string;
      idempotencyKey: string;
      confirmation: string;
    },
  ): Promise<OpsActionResult> {
    if (!perms.has(OPERATIONS_CONSOLE_PERMISSIONS.cacheInvalidate)) {
      throw new OpsConsoleError('forbidden', 'Missing operations.cache.invalidate', 403);
    }
    if (!input.reason?.trim()) {
      throw new OpsConsoleError('reason_required', 'Reason is required', 400);
    }
    if (!input.idempotencyKey?.trim()) {
      throw new OpsConsoleError('idempotency_required', 'Idempotency-Key is required', 400);
    }
    if (input.confirmation !== 'INVALIDATE') {
      throw new OpsConsoleError('confirmation_required', 'Confirmation INVALIDATE required', 400);
    }
    this.rateLimit.assertAllowed(claims.sub, 'cache_invalidate', 5);
    await this.requireFreshStepUp(claims);

    if (isOperationsConsoleFailureInjectionActive('source_state_validation')) {
      throw new OpsConsoleError('conflict', 'Source state conflict', 409);
    }
    if (isOperationsConsoleFailureInjectionActive('cache_invalidation')) {
      throw new OpsConsoleError('injected_failure', 'Injected cache invalidation failure', 500);
    }
    if (!this.eer) {
      throw new OpsConsoleError('source_unavailable', 'Entitlement runtime unavailable', 503);
    }

    const operation = OPERATIONS_CONSOLE_ACTIONS.CACHE_INVALIDATE;
    const requestHash = this.durable.fingerprint({
      op: operation,
      tenantId: input.tenantId,
      confirmation: 'INVALIDATE',
      reason: input.reason.trim(),
    });
    const cacheKey = `ops:cache-inv:${input.idempotencyKey}`;

    const processGate = this.processCache.beginOrReplay(
      cacheKey,
      claims.sub,
      operation,
      input.tenantId,
    );
    if (!processGate.proceed) {
      return processGate.replay.result as OpsActionResult;
    }

    const durableGate = await this.durable.claimOrReplay({
      actorId: claims.sub,
      operation,
      idempotencyKey: input.idempotencyKey,
      requestHash,
      resultResourceType: 'platformTenant',
      resultResourceId: input.tenantId,
    });
    if (durableGate.kind === 'replay') {
      this.warmProcessCache(cacheKey, claims.sub, operation, input.tenantId, durableGate.result);
      return durableGate.result;
    }

    if (isOperationsConsoleFailureInjectionActive('after_idempotency_claim')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected after idempotency claim', 500);
    }
    if (isOperationsConsoleFailureInjectionActive('before_commit')) {
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw new OpsConsoleError('injected_failure', 'Injected before commit', 500);
    }

    try {
      // Effect-idempotent local invalidation; durable claim proves exact request replay.
      this.eer.invalidateTenant(input.tenantId);
      this.query.markCacheInvalidated();

      const correlationId = resolveOperationCorrelationId();
      const result: OpsActionResult = {
        accepted: true,
        replayed: false,
        action: operation,
        targetId: input.tenantId,
        correlationId,
        result: 'accepted',
        sourceEffect: 'EffectiveEntitlementRuntimeService.invalidateTenant',
      };

      try {
        await this.prisma.withPlatformBypass(async (client) => {
          await this.durable.completeInTransaction(client, {
            actorId: claims.sub,
            operation,
            idempotencyKey: input.idempotencyKey,
            requestHash,
            resultResourceType: 'platformTenant',
            resultResourceId: input.tenantId,
            result,
          });
          await this.audit.recordInTransaction(client, {
            action: operation,
            resourceId: input.tenantId,
            actorId: claims.sub,
            actorRoles: (claims.roles as unknown as string[]) ?? [],
            reason: input.reason,
            correlationId,
            result: 'success',
            descriptionEn: 'Operations Console invalidated entitlement cache for tenant',
            descriptionAr: 'أبطلت وحدة العمليات ذاكرة التخزين المؤقت للاستحقاقات للمستأجر',
            details: { scope: 'tenant', sourceEffect: 'invalidateTenant' },
          });
        });
      } catch (err) {
        if (err instanceof OpsIdempotencyEquivalentRaceLostError) {
          const replayed = this.durable.payloadToResult(err.resultPayload);
          this.warmProcessCache(cacheKey, claims.sub, operation, input.tenantId, replayed);
          return replayed;
        }
        throw err;
      }

      this.warmProcessCache(cacheKey, claims.sub, operation, input.tenantId, {
        ...result,
        replayed: true,
      });

      if (isOperationsConsoleFailureInjectionActive('after_commit_before_response')) {
        throw new OpsConsoleError('injected_failure', 'Injected after commit before response', 500);
      }
      return result;
    } catch (err) {
      if (
        err instanceof OpsConsoleError &&
        err.code === 'injected_failure' &&
        isOperationsConsoleFailureInjectionActive('after_commit_before_response')
      ) {
        throw err;
      }
      await this.durable.releasePendingClaim({
        actorId: claims.sub,
        operation,
        idempotencyKey: input.idempotencyKey,
      });
      throw err;
    }
  }
}
