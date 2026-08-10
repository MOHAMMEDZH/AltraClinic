/**
 * Release 47 Step 10 — Platform Dashboard MVP service.
 *
 * Responsibilities:
 *  - Resolve the caller's effective platform permissions (fail-closed).
 *  - For each registry metric: enforce per-metric permission, short-circuit
 *    unavailable metrics, and resolve available aggregates with an in-memory
 *    TTL cache + isolated failure handling (Promise.allSettled).
 *  - Manual POST refresh bypasses the cache, rate-limited per platform user.
 *
 * Security posture: aggregates run under `withPlatformBypass` ONLY after the
 * caller's permission for that metric has been verified. No PHI, no tenant
 * identifiers, no clinical queries.
 */
import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  PLATFORM_DASHBOARD_CONFIG,
  type PlatformDashboardConfig,
} from '../config/platform-dashboard.config';
import {
  PLATFORM_DASHBOARD_METRICS,
  type MetricDefinition,
} from './metric-registry';
import { METRIC_RESOLVERS } from './resolvers';
import type {
  DashboardPrismaClient,
  MetricBreakdownValue,
} from './resolvers/resolver.types';
import type { MetricDto, PlatformDashboardDto } from './dto/platform-dashboard.dto';
import {
  assembleDashboard,
  buildDegradedMetric,
  buildPermissionLimitedMetric,
  buildResolvedMetric,
  buildUnavailableMetric,
} from './mappers/dashboard-response.mapper';

interface CacheEntry {
  readonly value: number | null;
  readonly breakdown?: MetricBreakdownValue[];
  /** Epoch ms when the value was computed. */
  readonly asOf: number;
}

export interface GetDashboardOptions {
  readonly refresh?: boolean;
}

/** Bump when cached MetricDto shape or resolver semantics change incompatibly. */
const DASHBOARD_CACHE_KEY_VERSION = 1;

@Injectable()
export class PlatformDashboardService {
  private readonly logger = new Logger(PlatformDashboardService.name);
  /**
   * Instance-local in-memory cache — not shared across API replicas or restarts.
   * Manual refresh and TTL expiry affect only this process; there is no cluster
   * invalidation. Rate-limit counters below are likewise instance-local.
   */
  private readonly cache = new Map<string, CacheEntry>();
  /** Instance-local: platformUserId → recent refresh timestamps (epoch ms). */
  private readonly refreshHits = new Map<string, number[]>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly authz: PlatformAuthorizationService,
    @Inject(PLATFORM_DASHBOARD_CONFIG) private readonly config: PlatformDashboardConfig,
  ) {}

  async getDashboard(
    claims: JwtClaimsVO,
    options: GetDashboardOptions = {},
  ): Promise<PlatformDashboardDto> {
    // Fail-closed: this returns [] for inactive/unknown users (canAuthenticate()).
    const permissions = new Set(await this.authz.resolveEffectivePermissions(claims.sub));

    const warnings: string[] = [];
    let refresh = options.refresh === true;
    if (refresh && !this.tryConsumeRefreshToken(claims.sub)) {
      refresh = false;
      warnings.push('refresh_rate_limited');
    }

    const resolvedMetrics = await Promise.allSettled(
      PLATFORM_DASHBOARD_METRICS.map((def) => this.resolveMetric(def, permissions, refresh)),
    );

    const metrics: MetricDto[] = resolvedMetrics.map((outcome, index) => {
      const def = PLATFORM_DASHBOARD_METRICS[index];
      if (outcome.status === 'fulfilled') return outcome.value;
      // Defense-in-depth: resolveMetric already isolates failures, but never
      // let a settled rejection collapse the whole dashboard.
      this.logger.warn(`Dashboard metric ${def.id} rejected unexpectedly`);
      return buildDegradedMetric(def);
    });

    if (metrics.some((metric) => metric.status === 'degraded')) {
      warnings.push('partial_degraded');
    }

    return assembleDashboard(metrics, {
      generatedAt: new Date().toISOString(),
      warnings,
    });
  }

  private async resolveMetric(
    def: MetricDefinition,
    permissions: Set<string>,
    refresh: boolean,
  ): Promise<MetricDto> {
    const authorized = def.requiredPermissions.every((perm) => permissions.has(perm));
    if (!authorized) return buildPermissionLimitedMetric(def);

    if (def.availability === 'unavailable' || !def.resolverKey) {
      return buildUnavailableMetric(def);
    }

    const cacheKey = `pd:v${DASHBOARD_CACHE_KEY_VERSION}:${def.id}`;
    const now = Date.now();
    const ttlMs = this.config.cacheTtlSeconds * 1000;
    const staleMs = this.config.staleAfterSeconds * 1000;

    if (!refresh) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        const age = now - cached.asOf;
        if (age <= staleMs) {
          return buildResolvedMetric(def, {
            value: cached.value,
            breakdown: cached.breakdown,
            asOf: new Date(cached.asOf).toISOString(),
            isStale: age > ttlMs,
            staleAfterSeconds: this.config.staleAfterSeconds,
          });
        }
      }
    }

    try {
      const resolver = METRIC_RESOLVERS[def.resolverKey];
      const result = await this.prisma.withPlatformBypass((client) =>
        resolver(client as unknown as DashboardPrismaClient),
      );
      this.cache.set(cacheKey, {
        value: result.value,
        breakdown: result.breakdown,
        asOf: now,
      });
      return buildResolvedMetric(def, {
        value: result.value,
        breakdown: result.breakdown,
        asOf: new Date(now).toISOString(),
        isStale: false,
        staleAfterSeconds: this.config.staleAfterSeconds,
      });
    } catch (err) {
      this.logger.warn(
        `Dashboard metric ${def.id} resolver failed: ${(err as Error)?.name ?? 'Error'}`,
      );
      // Never cache a failure as a valid zero — only reuse a prior good entry.
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return buildResolvedMetric(def, {
          value: cached.value,
          breakdown: cached.breakdown,
          asOf: new Date(cached.asOf).toISOString(),
          isStale: true,
          staleAfterSeconds: this.config.staleAfterSeconds,
        });
      }
      return buildDegradedMetric(def);
    }
  }

  /** Sliding-window refresh limiter keyed by platform user id. */
  private tryConsumeRefreshToken(userId: string): boolean {
    const windowMs = 60_000;
    const now = Date.now();
    const hits = (this.refreshHits.get(userId) ?? []).filter((ts) => now - ts < windowMs);
    if (hits.length >= this.config.refreshRateLimitPerMinute) {
      this.refreshHits.set(userId, hits);
      return false;
    }
    hits.push(now);
    this.refreshHits.set(userId, hits);
    return true;
  }
}
