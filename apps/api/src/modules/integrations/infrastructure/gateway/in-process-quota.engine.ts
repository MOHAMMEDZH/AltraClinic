/**
 * Phase 44d — In-process sliding-window + burst token bucket (OD-REDIS deferred).
 * Single-node only; not shared across instances.
 */

import type {
  QuotaConsumeResult,
  QuotaEvaluationInput,
  QuotaEvaluationResult,
  QuotaPolicyDefinition,
  QuotaScopeKind,
  RateLimitWindow,
} from '../../domain/gateway/quota.types';
import {
  DEFAULT_BURST_LIMIT,
  DEFAULT_CREDENTIAL_WINDOW,
  DEFAULT_ENDPOINT_WINDOW,
  DEFAULT_SERVICE_ACCOUNT_WINDOW,
  DEFAULT_TENANT_WINDOW,
} from '../../domain/gateway/quota.types';

interface WindowBucket {
  count: number;
  windowStartMs: number;
  windowSeconds: number;
  limit: number;
}

interface BurstBucket {
  tokens: number;
  lastRefillMs: number;
  capacity: number;
  /** Tokens refilled per second. */
  refillPerSecond: number;
}

export class InProcessQuotaEngine {
  private readonly windows = new Map<string, WindowBucket>();
  private readonly bursts = new Map<string, BurstBucket>();
  private readonly policies = new Map<string, QuotaPolicyDefinition>();
  private readonly tenantOverrides = new Map<string, Partial<Record<QuotaScopeKind, RateLimitWindow>>>();

  listPolicies(): readonly QuotaPolicyDefinition[] {
    return [...this.policies.values()];
  }

  upsertPolicy(policy: QuotaPolicyDefinition): void {
    this.policies.set(policy.id, { ...policy });
  }

  setTenantWindowOverride(
    tenantId: string,
    scopeKind: QuotaScopeKind,
    window: RateLimitWindow,
  ): void {
    const prev = this.tenantOverrides.get(tenantId) ?? {};
    this.tenantOverrides.set(tenantId, { ...prev, [scopeKind]: window });
  }

  reset(keyPrefix?: string): void {
    if (!keyPrefix) {
      this.windows.clear();
      this.bursts.clear();
      return;
    }
    for (const key of [...this.windows.keys()]) {
      if (key.startsWith(keyPrefix)) this.windows.delete(key);
    }
    for (const key of [...this.bursts.keys()]) {
      if (key.startsWith(keyPrefix)) this.bursts.delete(key);
    }
  }

  evaluate(input: QuotaEvaluationInput): QuotaEvaluationResult {
    return this.evaluateInternal(input, false);
  }

  consume(input: QuotaEvaluationInput): QuotaConsumeResult {
    const result = this.evaluateInternal(input, true);
    return { ...result, consumed: result.allowed };
  }

  getDiagnostics(tenantId?: string): {
    windowBuckets: number;
    burstBuckets: number;
    policies: number;
    sampleRemaining: number | null;
  } {
    let sampleRemaining: number | null = null;
    if (tenantId) {
      const evalResult = this.evaluate({
        tenantId,
        credentialId: 'diagnostics',
        serviceAccountId: null,
        endpoint: 'diagnostics',
        operation: 'inspect',
      });
      sampleRemaining = evalResult.remaining;
    }
    return {
      windowBuckets: this.windows.size,
      burstBuckets: this.bursts.size,
      policies: this.policies.size,
      sampleRemaining,
    };
  }

  private evaluateInternal(
    input: QuotaEvaluationInput,
    consume: boolean,
  ): QuotaEvaluationResult {
    const now = input.nowMs ?? Date.now();
    const checks: Array<{
      scope: QuotaScopeKind;
      key: string;
      window: RateLimitWindow;
      burst: number;
    }> = [
      {
        scope: 'tenant',
        key: `tenant:${input.tenantId}`,
        window: this.resolveWindow(input.tenantId, 'tenant', DEFAULT_TENANT_WINDOW),
        burst: DEFAULT_BURST_LIMIT,
      },
      {
        scope: 'credential',
        key: `credential:${input.tenantId}:${input.credentialId}`,
        window: this.resolveWindow(
          input.tenantId,
          'credential',
          DEFAULT_CREDENTIAL_WINDOW,
        ),
        burst: DEFAULT_BURST_LIMIT,
      },
      {
        scope: 'endpoint',
        key: `endpoint:${input.tenantId}:${input.endpoint}`,
        window: this.resolveWindow(
          input.tenantId,
          'endpoint',
          DEFAULT_ENDPOINT_WINDOW,
        ),
        burst: Math.min(DEFAULT_BURST_LIMIT, 20),
      },
      {
        scope: 'operation',
        key: `operation:${input.tenantId}:${input.operation}`,
        window: this.resolveWindow(
          input.tenantId,
          'operation',
          DEFAULT_ENDPOINT_WINDOW,
        ),
        burst: Math.min(DEFAULT_BURST_LIMIT, 20),
      },
    ];

    if (input.serviceAccountId) {
      checks.splice(2, 0, {
        scope: 'service_account',
        key: `sa:${input.tenantId}:${input.serviceAccountId}`,
        window: this.resolveWindow(
          input.tenantId,
          'service_account',
          DEFAULT_SERVICE_ACCOUNT_WINDOW,
        ),
        burst: DEFAULT_BURST_LIMIT,
      });
    }

    let tightestRemaining = Number.POSITIVE_INFINITY;
    let tightestLimit = 0;
    let tightestReset = now;
    let violated: QuotaScopeKind | null = null;
    let retryAfter: number | null = null;

    for (const check of checks) {
      const windowResult = this.checkWindow(check.key, check.window, now, consume);
      const burstResult = this.checkBurst(
        check.key,
        check.burst,
        check.window,
        now,
        consume && windowResult.allowed,
      );

      const remaining = Math.min(windowResult.remaining, burstResult.remaining);
      if (remaining < tightestRemaining) {
        tightestRemaining = remaining;
        tightestLimit = check.window.limit;
        tightestReset = windowResult.resetAtMs;
      }

      if (!windowResult.allowed || !burstResult.allowed) {
        violated = check.scope;
        retryAfter = Math.max(
          1,
          Math.ceil((windowResult.resetAtMs - now) / 1000),
        );
        // Do not continue consuming subsequent scopes after denial when consume=true
        // — window/burst already only consumed when allowed.
        return {
          allowed: false,
          remaining: Math.max(0, remaining),
          limit: tightestLimit,
          resetAtMs: tightestReset,
          violatedScope: violated,
          retryAfterSeconds: retryAfter,
        };
      }
    }

    return {
      allowed: true,
      remaining: Number.isFinite(tightestRemaining)
        ? Math.max(0, tightestRemaining)
        : 0,
      limit: tightestLimit,
      resetAtMs: tightestReset,
      violatedScope: null,
      retryAfterSeconds: null,
    };
  }

  private resolveWindow(
    tenantId: string,
    scope: QuotaScopeKind,
    fallback: RateLimitWindow,
  ): RateLimitWindow {
    const override = this.tenantOverrides.get(tenantId)?.[scope];
    if (override) return override;
    for (const policy of this.policies.values()) {
      if (
        policy.enabled &&
        policy.scopeKind === scope &&
        (policy.tenantId === null || policy.tenantId === tenantId)
      ) {
        return policy.window;
      }
    }
    return fallback;
  }

  private checkWindow(
    key: string,
    window: RateLimitWindow,
    now: number,
    consume: boolean,
  ): { allowed: boolean; remaining: number; resetAtMs: number } {
    const windowMs = window.windowSeconds * 1000;
    let bucket = this.windows.get(key);
    if (!bucket || now - bucket.windowStartMs >= windowMs) {
      bucket = {
        count: 0,
        windowStartMs: now,
        windowSeconds: window.windowSeconds,
        limit: window.limit,
      };
      this.windows.set(key, bucket);
    }
    bucket.limit = window.limit;
    const resetAtMs = bucket.windowStartMs + windowMs;
    if (bucket.count >= window.limit) {
      return { allowed: false, remaining: 0, resetAtMs };
    }
    if (consume) {
      bucket.count += 1;
    }
    return {
      allowed: true,
      remaining: Math.max(0, window.limit - bucket.count),
      resetAtMs,
    };
  }

  private checkBurst(
    key: string,
    capacity: number,
    window: RateLimitWindow,
    now: number,
    consume: boolean,
  ): { allowed: boolean; remaining: number } {
    const refillPerSecond = window.limit / Math.max(1, window.windowSeconds);
    let bucket = this.bursts.get(key);
    if (!bucket) {
      bucket = {
        tokens: capacity,
        lastRefillMs: now,
        capacity,
        refillPerSecond,
      };
      this.bursts.set(key, bucket);
    }
    const elapsedSec = Math.max(0, (now - bucket.lastRefillMs) / 1000);
    bucket.tokens = Math.min(
      capacity,
      bucket.tokens + elapsedSec * refillPerSecond,
    );
    bucket.lastRefillMs = now;
    bucket.capacity = capacity;
    bucket.refillPerSecond = refillPerSecond;

    if (bucket.tokens < 1) {
      return { allowed: false, remaining: 0 };
    }
    if (consume) {
      bucket.tokens -= 1;
    }
    return { allowed: true, remaining: Math.floor(bucket.tokens) };
  }
}
