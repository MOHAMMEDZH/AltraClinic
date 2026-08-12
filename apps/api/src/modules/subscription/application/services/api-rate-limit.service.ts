import { Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { RateLimiterService, RateLimitResult } from '../../../../infrastructure/redis/services/rate-limiter.service';
import { RedisKeyBuilder } from '../../../../infrastructure/redis/redis-key.builder';
import { UNLIMITED } from '../../domain/config/plan-limits.config';
import { LicensingEngineService } from './licensing-engine.service';
import { ApiRateLimitExceededException } from '../../domain/exceptions/api-rate-limit-exceeded.exception';
import { LicensingAuditService } from './licensing-audit.service';

export type ApiRateLimitScope =
  | 'public_ip'
  | 'tenant'
  | 'tenant_user'
  | 'tenant_api_key'
  | 'ai_burst'
  | 'export';

export interface ApiRateLimitPolicy {
  scope: ApiRateLimitScope;
  limit: number;
  windowSeconds: number;
  algorithm: 'fixed' | 'sliding';
}

function normalizePath(path: string): string {
  return path.split('?')[0].toLowerCase();
}

@Injectable()
export class ApiRateLimitService {
  private readonly logger = new Logger(ApiRateLimitService.name);
  private readonly abuseCounter = new Map<string, number>();

  constructor(
    private readonly rateLimiter: RateLimiterService,
    private readonly keys: RedisKeyBuilder,
    private readonly licensing: LicensingEngineService,
    private readonly audit: LicensingAuditService,
  ) {}

  resolvePolicy(request: Request): ApiRateLimitPolicy {
    const path = normalizePath(request.path ?? request.url ?? '');

    if (path.startsWith('/auth') || path.startsWith('/platform/auth')) {
      return { scope: 'public_ip', limit: 60, windowSeconds: 60, algorithm: 'sliding' };
    }

    if (path.startsWith('/ai')) {
      return { scope: 'ai_burst', limit: 120, windowSeconds: 60, algorithm: 'fixed' };
    }

    if (path.includes('/export') || path.includes('/reports') && request.method === 'POST') {
      return { scope: 'export', limit: 30, windowSeconds: 3600, algorithm: 'fixed' };
    }

    if (path.startsWith('/settings/developer')) {
      return { scope: 'tenant_api_key', limit: 5_000, windowSeconds: 86_400, algorithm: 'fixed' };
    }

    return { scope: 'tenant_user', limit: 0, windowSeconds: 3600, algorithm: 'fixed' };
  }

  async enforce(request: Request): Promise<RateLimitResult> {
    if (process.env.NODE_ENV === 'test') {
      return { allowed: true, count: 0, limit: UNLIMITED, remaining: UNLIMITED, resetAt: 0 };
    }

    const policy = this.resolvePolicy(request);
    const tenantId = this.extractTenantId(request);
    const userId = this.extractUserId(request);
    const ip = this.extractIp(request);
    const apiKey = this.extractApiKey(request);

    let limit = policy.limit;
    if (policy.scope === 'tenant_user' && tenantId) {
      const license = await this.licensing.resolveLicense(tenantId);
      const daily = license.effectiveLimits.maxApiRequestsPerDay;
      if (daily === UNLIMITED) {
        return { allowed: true, count: 0, limit: UNLIMITED, remaining: UNLIMITED, resetAt: 0 };
      }
      limit = Math.max(1, Math.ceil(daily / 24));
    }

    const key = this.buildKey(policy.scope, {
      tenantId,
      userId,
      ip,
      apiKey,
      path: normalizePath(request.path ?? ''),
    });

    const result =
      policy.algorithm === 'sliding'
        ? await this.rateLimiter.checkSlidingWindow(key, limit, policy.windowSeconds)
        : await this.rateLimiter.checkFixedWindow(key, limit, policy.windowSeconds);

    if (!result.allowed) {
      if (tenantId) {
        await this.audit.recordLicenseEvent({
          tenantId,
          eventType: 'rate_limit.denied',
          decision: 'denied',
          reason: `Rate limit exceeded for scope ${policy.scope}`,
          source: 'http.rate_limit',
          requestId: request.headers['x-request-id'] as string | undefined,
          metadata: { scope: policy.scope, path: request.path, limit: result.limit, count: result.count },
        });
      }
      await this.recordAbuse(tenantId, policy.scope, request);
      throw new ApiRateLimitExceededException({
        retryAfterSeconds: Math.max(1, result.resetAt - Math.floor(Date.now() / 1000)),
        limit: result.limit,
        remaining: result.remaining,
        resetAt: result.resetAt,
        scope: policy.scope,
        reason: `Rate limit exceeded for scope ${policy.scope}`,
      });
    }

    return result;
  }

  applyHeaders(response: { setHeader: (k: string, v: string) => void }, result: RateLimitResult): void {
    if (result.limit === UNLIMITED) return;
    response.setHeader('X-RateLimit-Limit', String(result.limit));
    response.setHeader('X-RateLimit-Remaining', String(result.remaining));
    response.setHeader('X-RateLimit-Reset', String(result.resetAt));
  }

  private buildKey(
    scope: ApiRateLimitScope,
    ctx: {
      tenantId?: string;
      userId?: string;
      ip?: string;
      apiKey?: string;
      path: string;
    },
  ): string {
    switch (scope) {
      case 'public_ip':
        return this.keys.ipRateLimit(ctx.ip ?? 'unknown', RedisKeyBuilder.currentMinuteWindow());
      case 'ai_burst':
        return this.keys.aiInferenceRateLimit(
          ctx.tenantId ?? '_unknown',
          ctx.userId ?? '_unknown',
          RedisKeyBuilder.currentMinuteWindow(),
        );
      case 'export':
        return this.keys.apiRateLimit(ctx.tenantId ?? '_unknown', `export:${RedisKeyBuilder.currentHourWindow()}`);
      case 'tenant_api_key':
        return this.keys.apiRateLimit(
          ctx.tenantId ?? '_unknown',
          `apikey:${ctx.apiKey ?? 'none'}:${RedisKeyBuilder.todayUtc()}`,
        );
      case 'tenant':
        return this.keys.apiRateLimit(ctx.tenantId ?? '_unknown', RedisKeyBuilder.currentHourWindow());
      case 'tenant_user':
      default:
        return this.keys.apiRateLimit(
          ctx.tenantId ?? '_unknown',
          `user:${ctx.userId ?? 'anon'}:${RedisKeyBuilder.currentHourWindow()}`,
        );
    }
  }

  private extractTenantId(request: Request): string | undefined {
    const user = (request as { user?: { tenantId?: string } }).user;
    const header = request.headers['x-tenant-id'];
    return user?.tenantId ?? (typeof header === 'string' ? header : undefined);
  }

  private extractUserId(request: Request): string | undefined {
    const user = (request as { user?: { sub?: string; id?: string } }).user;
    return user?.sub ?? user?.id;
  }

  private extractApiKey(request: Request): string | undefined {
    const header = request.headers['x-api-key'];
    return typeof header === 'string' ? header : undefined;
  }

  /**
   * Client IP for rate-limit keying.
   * Honor X-Forwarded-For only when TRUST_PROXY is explicitly enabled
   * (deployment behind a trusted reverse proxy). Otherwise use socket IP
   * to resist client-spoofed forwarding headers (Step 28 RL spoof resistance).
   */
  private extractIp(request: Request): string {
    const trustProxy =
      process.env.TRUST_PROXY === 'true' ||
      process.env.TRUST_PROXY === '1' ||
      process.env.TRUSTED_PROXY === 'true' ||
      process.env.TRUSTED_PROXY === '1';

    if (trustProxy) {
      const forwarded = request.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.length > 0) {
        const first = forwarded.split(',')[0]?.trim();
        if (first) return first;
      }
    }

    return request.ip ?? request.socket?.remoteAddress ?? '0.0.0.0';
  }

  private async recordAbuse(tenantId: string | undefined, scope: string, request: Request): Promise<void> {
    const key = `${tenantId ?? 'public'}:${scope}`;
    const count = (this.abuseCounter.get(key) ?? 0) + 1;
    this.abuseCounter.set(key, count);

    if (count >= 5 && tenantId) {
      await this.audit.recordLicenseEvent({
        tenantId,
        eventType: 'api.rate_limit_abuse',
        decision: 'denied',
        reason: `Repeated API rate limit violations (${count})`,
        source: 'http.rate_limit',
        requestId: request.headers['x-request-id'] as string | undefined,
        metadata: { scope, path: request.path, count },
      });
    }
  }
}
