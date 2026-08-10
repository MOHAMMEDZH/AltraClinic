/**
 * Phase 44d — Gateway & Quota orchestration (OD-AUTHN pipeline).
 */

import { randomUUID } from 'crypto';
import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiCredentialRepository } from '../ports/repositories';
import { API_CREDENTIAL_REPOSITORY } from '../ports/repositories';
import {
  SERVICE_ACCOUNT_REPOSITORY,
  type ServiceAccountRepository,
} from '../ports/repositories';
import type { IntegrationGateway, QuotaService } from '../ports/services';
import {
  hashApiCredential,
  isPepperConfigured,
  redactCredentialSecrets,
  resolvePepperMaterial,
  verifyApiCredentialHash,
} from '../../domain/credential-hashing';
import { isCredentialAuthnEligible } from '../../domain/credential-status.machine';
import { parseApiKeyFromHeaders } from '../../domain/gateway/api-key-header.parser';
import type {
  IntegrationsAuthResult,
  IntegrationsGatewayPrincipal,
} from '../../domain/gateway/gateway.types';
import type {
  QuotaEvaluationInput,
  QuotaPolicyDefinition,
  RateLimitWindow,
  QuotaScopeKind,
} from '../../domain/gateway/quota.types';
import { isApiKeysIntegrationsCenterEnabled } from '../../config/integrations-config';
import { TenantPolicyService } from '../../../settings/application/services/tenant-policy.service';
import { CatalogScopeAuthorizer } from '../credential-hashing.adapters';
import { IntegrationsActivityEmitterService } from '../integrations-activity.emitter';
import { IntegrationsAuditLog } from '../../infrastructure/integrations-audit.log';
import { IntegrationsCredentialObservabilityHooks } from '../integrations-credential-observability.hooks';
import { IntegrationsNotificationIntentRegistrar } from '../integrations-notification-intent.registrar';
import { InProcessQuotaEngine } from '../../infrastructure/gateway/in-process-quota.engine';
import { InMemoryUsageAccountingStore } from '../../infrastructure/gateway/in-memory-usage.store';
import type { ApiCredential } from '../../domain/integrations.entities';

export interface GatewayAuthenticateInput {
  authorization?: string | string[] | null;
  apiKey?: string | string[] | null;
  /** Optional tenant hint (X-Tenant-Id); when absent, hash lookup is global. */
  tenantIdHint?: string | null;
  requiredScopes?: readonly string[];
  endpoint?: string;
  operation?: string;
  correlationId?: string | null;
  now?: Date;
}

@Injectable()
export class IntegrationsGatewayService
  implements IntegrationGateway, QuotaService
{
  readonly contractVersion = '44d' as const;
  private readonly logger = new Logger(IntegrationsGatewayService.name);
  private readonly quotaEngine = new InProcessQuotaEngine();
  private readonly usage = new InMemoryUsageAccountingStore();

  constructor(
    @Inject(API_CREDENTIAL_REPOSITORY)
    private readonly credentials: ApiCredentialRepository,
    @Inject(SERVICE_ACCOUNT_REPOSITORY)
    private readonly serviceAccounts: ServiceAccountRepository,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly scopeAuthorizer: CatalogScopeAuthorizer,
    private readonly activity: IntegrationsActivityEmitterService,
    private readonly audit: IntegrationsAuditLog,
    private readonly metrics: IntegrationsCredentialObservabilityHooks,
    private readonly notificationIntents: IntegrationsNotificationIntentRegistrar,
  ) {}

  /** OD-AUTHN pipeline — authenticate + authorize scopes + quota. */
  async authenticate(
    input: GatewayAuthenticateInput,
  ): Promise<IntegrationsAuthResult> {
    const started = Date.now();
    const correlationId = input.correlationId?.trim() || randomUUID();
    const endpoint = input.endpoint ?? 'unknown';
    const operation = input.operation ?? 'request';

    const parsed = parseApiKeyFromHeaders({
      authorization: input.authorization,
      apiKey: input.apiKey,
    });

    if (parsed.kind === 'none') {
      return this.fail(
        'missing_credential',
        401,
        'API key required',
        started,
        null,
        endpoint,
        operation,
        correlationId,
      );
    }
    if (parsed.kind === 'reject') {
      return this.fail(
        parsed.reason,
        401,
        parsed.reason === 'jwt_not_api_key'
          ? 'JWT Bearer is not an Integrations API key'
          : 'Invalid API key format',
        started,
        null,
        endpoint,
        operation,
        correlationId,
      );
    }

    if (!isApiKeysIntegrationsCenterEnabled()) {
      return this.fail(
        'feature_disabled',
        403,
        'API_KEYS_INTEGRATIONS_CENTER_ENABLED=false — Integrations Center dormant',
        started,
        null,
        endpoint,
        operation,
        correlationId,
      );
    }

    if (!isPepperConfigured()) {
      return this.fail(
        'pepper_missing',
        403,
        'API credential pepper missing — fail closed',
        started,
        null,
        endpoint,
        operation,
        correlationId,
      );
    }

    const pepper = resolvePepperMaterial()!;
    const keyHash = hashApiCredential(parsed.credential.raw, pepper);

    let credential: ApiCredential | null = null;
    if (input.tenantIdHint) {
      credential = await this.credentials.findByKeyHash(
        input.tenantIdHint,
        keyHash,
      );
    }
    if (!credential && 'findByKeyHashGlobal' in this.credentials) {
      credential = await (
        this.credentials as ApiCredentialRepository & {
          findByKeyHashGlobal: (h: string) => Promise<ApiCredential | null>;
        }
      ).findByKeyHashGlobal(keyHash);
    }
    // Fallback: scan list if global helper absent (should not happen for in-memory).
    if (!credential) {
      return this.fail(
        'not_found',
        401,
        'Invalid API key',
        started,
        input.tenantIdHint ?? null,
        endpoint,
        operation,
        correlationId,
      );
    }

    // Constant-time verify even after hash lookup (defense in depth).
    if (
      !verifyApiCredentialHash(parsed.credential.raw, credential.keyHash, pepper)
    ) {
      return this.fail(
        'hash_mismatch',
        401,
        'Invalid API key',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }

    if (
      input.tenantIdHint &&
      input.tenantIdHint !== credential.tenantId
    ) {
      return this.fail(
        'tenant_mismatch',
        403,
        'Tenant mismatch',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }

    const authLatencyMs = Date.now() - started;
    const now = input.now ?? new Date();

    if (credential.status === 'revoked') {
      return this.fail(
        'revoked',
        401,
        'API key revoked',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }
    if (credential.status === 'expired') {
      return this.fail(
        'expired',
        401,
        'API key expired',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }
    if (
      !isCredentialAuthnEligible({
        status: credential.status,
        expiresAt: credential.expiresAt,
        rotationGraceEndsAt: credential.rotationGraceEndsAt,
        now,
      })
    ) {
      return this.fail(
        'not_eligible',
        401,
        'API key not eligible',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }

    const policy = await this.tenantPolicy.getAdvancedPolicy(
      credential.tenantId,
    );
    if (!policy.allowIntegrations) {
      return this.fail(
        'license_denied',
        403,
        'Integrations not licensed for tenant',
        started,
        credential.tenantId,
        endpoint,
        operation,
        correlationId,
        credential.id,
      );
    }

    let serviceAccountId: string | null = null;
    if (credential.ownerType === 'service_account') {
      serviceAccountId = credential.ownerId;
      const sa = await this.serviceAccounts.findById(
        credential.tenantId,
        credential.ownerId,
      );
      if (!sa || sa.status === 'disabled') {
        return this.fail(
          'service_account_disabled',
          401,
          'Service account disabled',
          started,
          credential.tenantId,
          endpoint,
          operation,
          correlationId,
          credential.id,
        );
      }
    }

    const authzStarted = Date.now();
    const required = input.requiredScopes ?? [];
    if (
      required.length > 0 &&
      !this.scopeAuthorizer.authorize(credential.scopes, required)
    ) {
      await this.rejectAuthz(
        credential,
        'scope_denied',
        endpoint,
        operation,
        correlationId,
        Date.now() - started,
      );
      return {
        ok: false,
        reason: 'scope_denied',
        statusCode: 403,
        message: 'Insufficient API key scopes',
        authLatencyMs,
      };
    }
    const authorizationLatencyMs = Date.now() - authzStarted;

    const quotaStarted = Date.now();
    const quotaInput: QuotaEvaluationInput = {
      tenantId: credential.tenantId,
      credentialId: credential.id,
      serviceAccountId,
      endpoint,
      operation,
      nowMs: now.getTime(),
    };
    const quota = this.quotaEngine.consume(quotaInput);
    const quotaLatencyMs = Date.now() - quotaStarted;

    if (!quota.allowed) {
      this.metrics.increment('integrations.quota.exceeded');
      this.usage.record({
        tenantId: credential.tenantId,
        credentialId: credential.id,
        serviceAccountId,
        endpoint,
        operation,
        outcome: 'quota_failure',
        reason: quota.violatedScope ?? 'quota',
        latencyMs: Date.now() - started,
        correlationId,
        at: now.toISOString(),
      });
      await this.activity.emit('quota_exceeded', {
        tenantId: credential.tenantId,
        credentialId: credential.id,
        status: 'quota_exceeded',
        correlationId,
        reason: quota.violatedScope ?? undefined,
      });
      await this.audit.record({
        tenantId: credential.tenantId,
        action: 'integrations.quota.exceeded',
        resourceId: credential.id,
        actorId: credential.ownerId,
        actorRoles: ['integrations_api_key'],
        correlationId,
        details: {
          scope: quota.violatedScope ?? 'unknown',
          endpoint,
          operation,
        },
      });
      this.notificationIntents.recordIntent('quota_exceeded', {
        tenantId: credential.tenantId,
        credentialId: credential.id,
        correlationId,
      });
      return {
        ok: false,
        reason: 'quota_exceeded',
        statusCode: 429,
        message: 'API key quota exceeded',
        authLatencyMs,
      };
    }

    // Touch lastUsedAt (best-effort; never log raw key).
    const touched: ApiCredential = {
      ...credential,
      lastUsedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    await this.credentials.save(touched);

    const principal: IntegrationsGatewayPrincipal = {
      kind: 'integrations_api_key',
      tenantId: credential.tenantId,
      branchId: credential.branchId,
      credentialId: credential.id,
      credentialPrefix: credential.prefix,
      ownerType: credential.ownerType,
      ownerId: credential.ownerId,
      serviceAccountId,
      scopes: [...credential.scopes],
      correlationId,
      authSource: parsed.credential.source,
    };

    this.metrics.increment('integrations.auth.success');
    this.usage.record({
      tenantId: credential.tenantId,
      credentialId: credential.id,
      serviceAccountId,
      endpoint,
      operation,
      outcome: 'success',
      latencyMs: Date.now() - started,
      correlationId,
      at: now.toISOString(),
    });

    this.logger.log({
      kind: 'integrations',
      component: 'gateway',
      event: 'auth_success',
      tenantId: principal.tenantId,
      credentialId: principal.credentialId,
      prefix: principal.credentialPrefix,
      authSource: principal.authSource,
      correlationId,
      authLatencyMs,
      authorizationLatencyMs,
      quotaLatencyMs,
    });

    return {
      ok: true,
      principal,
      authLatencyMs,
      authorizationLatencyMs,
      quotaLatencyMs,
      remainingQuota: quota.remaining,
    };
  }

  /**
   * Guard helper — throws Nest HTTP exceptions on failure.
   */
  async authenticateOrThrow(
    input: GatewayAuthenticateInput,
  ): Promise<IntegrationsGatewayPrincipal> {
    const result = await this.authenticate(input);
    if (result.ok) return result.principal;
    if (result.statusCode === 429) {
      throw new HttpException(
        {
          statusCode: 429,
          message: result.message,
          reason: result.reason,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (result.statusCode === 403) {
      throw new ForbiddenException(result.message);
    }
    throw new UnauthorizedException(result.message);
  }

  // --- Quota admin ---

  evaluateQuota(input: QuotaEvaluationInput) {
    return this.quotaEngine.evaluate(input);
  }

  consumeQuota(input: QuotaEvaluationInput) {
    return this.quotaEngine.consume(input);
  }

  resetQuota(keyPrefix?: string): void {
    this.quotaEngine.reset(keyPrefix);
  }

  setTenantQuotaWindow(
    tenantId: string,
    scopeKind: QuotaScopeKind,
    window: RateLimitWindow,
  ): void {
    this.quotaEngine.setTenantWindowOverride(tenantId, scopeKind, window);
  }

  upsertQuotaPolicy(policy: QuotaPolicyDefinition): void {
    this.quotaEngine.upsertPolicy(policy);
  }

  listQuotaPolicies(): readonly QuotaPolicyDefinition[] {
    return this.quotaEngine.listPolicies();
  }

  getUsageSnapshot(tenantId: string) {
    return this.usage.snapshot(tenantId);
  }

  getDiagnostics(tenantId?: string) {
    return {
      wired: true,
      contractVersion: this.contractVersion,
      authHeaders: ['Authorization: Bearer', 'X-Api-Key'],
      prefixes: ['bk_', 'bki_'],
      quotaBackend: 'in_process' as const,
      redisDeferred: true,
      featureEnabled: isApiKeysIntegrationsCenterEnabled(),
      pepperReady: isPepperConfigured(),
      quota: this.quotaEngine.getDiagnostics(tenantId),
      usage: tenantId ? this.usage.snapshot(tenantId).totals : null,
    };
  }

  private async fail(
    reason: import('../../domain/gateway/gateway.types').IntegrationsAuthRejectionReason,
    statusCode: 401 | 403 | 429,
    message: string,
    started: number,
    tenantId: string | null,
    endpoint: string,
    operation: string,
    correlationId: string,
    credentialId?: string,
  ): Promise<IntegrationsAuthResult> {
    this.metrics.increment('integrations.auth.rejected');
    const tid = tenantId ?? 'unknown';
    this.usage.record({
      tenantId: tid,
      credentialId: credentialId ?? null,
      serviceAccountId: null,
      endpoint,
      operation,
      outcome:
        reason === 'scope_denied'
          ? 'authorization_failure'
          : reason === 'quota_exceeded'
            ? 'quota_failure'
            : 'auth_failure',
      reason,
      latencyMs: Date.now() - started,
      correlationId,
      at: new Date().toISOString(),
    });

    if (tenantId && tenantId !== 'unknown') {
      await this.activity.emit('auth_rejected', {
        tenantId,
        credentialId,
        status: reason,
        correlationId,
        reason,
      });
      await this.audit.record({
        tenantId,
        action: 'integrations.auth.rejected',
        resourceId: credentialId ?? 'unknown',
        actorId: 'anonymous',
        actorRoles: ['integrations_api_key'],
        correlationId,
        details: { reason, endpoint, operation },
        reason,
      });
    }

    this.logger.warn({
      kind: 'integrations',
      component: 'gateway',
      event: 'auth_rejected',
      reason,
      tenantId: tenantId ?? null,
      credentialId: credentialId ?? null,
      correlationId,
      message: redactCredentialSecrets(message),
    });

    return {
      ok: false,
      reason,
      statusCode,
      message,
      authLatencyMs: Date.now() - started,
    };
  }

  private async rejectAuthz(
    credential: ApiCredential,
    reason: string,
    endpoint: string,
    operation: string,
    correlationId: string,
    latencyMs: number,
  ): Promise<void> {
    this.metrics.increment('integrations.auth.rejected');
    this.usage.record({
      tenantId: credential.tenantId,
      credentialId: credential.id,
      serviceAccountId:
        credential.ownerType === 'service_account' ? credential.ownerId : null,
      endpoint,
      operation,
      outcome: 'authorization_failure',
      reason,
      latencyMs,
      correlationId,
      at: new Date().toISOString(),
    });
    await this.activity.emit('auth_rejected', {
      tenantId: credential.tenantId,
      credentialId: credential.id,
      status: reason,
      correlationId,
      reason,
    });
    await this.audit.record({
      tenantId: credential.tenantId,
      action: 'integrations.auth.rejected',
      resourceId: credential.id,
      actorId: credential.ownerId,
      actorRoles: ['integrations_api_key'],
      correlationId,
      details: { reason, endpoint, operation },
      reason,
    });
  }
}
