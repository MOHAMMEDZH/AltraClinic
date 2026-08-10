import { createHash } from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { isFeatureFlagsSettingsFailureInjectionActive } from '../feature-flags-settings.constants';
import {
  FeatureFlagsSettingsError,
  type FeatureFlagsSettingsFailureInjectionPoint,
  type OperationalDecisionInput,
  type OperationalDecisionResult,
  type OperationalExplanationCode,
} from '../domain/feature-flags-settings.types';

type CacheEntry = {
  rowVersion: number;
  result: OperationalDecisionResult;
  expiresAt: number;
};

/**
 * Operational decision layer around Flexible Step 18 EER.
 * Never grants when entitlement denies. Never bypasses lifecycle denial.
 */
@Injectable()
export class OperationalDecisionService {
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  /** Test-only. Hard-gated: NODE_ENV === 'test' + exact injection selector. */
  private maybeInject(point: FeatureFlagsSettingsFailureInjectionPoint): void {
    if (!isFeatureFlagsSettingsFailureInjectionActive(point)) {
      return;
    }
    throw new FeatureFlagsSettingsError('injected_failure', `Injected failure at ${point}`, 500);
  }

  invalidateFlag(flagKey: string): void {
    const prefix = `${flagKey}::`;
    for (const key of [...this.cache.keys()]) {
      if (key.startsWith(prefix)) this.cache.delete(key);
    }
  }

  invalidateAll(): void {
    this.cache.clear();
  }

  /** Deterministic bucket 0..99 — stable across restarts/instances. */
  static percentageBucket(flagKey: string, tenantId: string): number {
    const digest = createHash('sha256').update(`${flagKey}:${tenantId}`).digest('hex');
    const n = parseInt(digest.slice(0, 8), 16);
    return Number.isFinite(n) ? n % 100 : 0;
  }

  isTenantInPercentage(flagKey: string, tenantId: string, percentage: number): boolean {
    const pct = Math.max(0, Math.min(100, percentage));
    return OperationalDecisionService.percentageBucket(flagKey, tenantId) < pct;
  }

  async evaluate(input: OperationalDecisionInput): Promise<OperationalDecisionResult> {
    if (input.lifecycleDenied) {
      return this.result(input, false, 'lifecycle_denied', false, false, null);
    }
    if (!input.entitlementAllows) {
      return this.result(input, false, 'entitlement_denied', false, false, null);
    }

    // F15 — operational ↔ EER adapter boundary (after entitlement allow only).
    this.maybeInject('eer_adapter_failure');

    const flag = await this.prisma.withPlatformBypass((client) =>
      client.platformFeatureFlag.findUnique({
        where: { canonicalKey: input.flagKey },
        include: { targets: true },
      }),
    );

    if (!flag || flag.status !== 'ACTIVE') {
      return this.result(input, true, 'flag_not_applicable', false, true, flag?.rowVersion ?? null);
    }

    const cacheKey = `${flag.canonicalKey}::${input.tenantId}::${flag.rowVersion}`;
    const hit = this.cache.get(cacheKey);
    if (hit && hit.expiresAt > Date.now() && hit.rowVersion === flag.rowVersion) {
      return hit.result;
    }

    if (flag.killSwitchActive) {
      return this.store(
        cacheKey,
        flag.rowVersion,
        this.result(input, false, 'kill_switch_denied', true, false, flag.rowVersion),
      );
    }

    // F19 — target resolution (allowlist / denylist / percentage / missing rows).
    this.maybeInject('target_resolution_failure');
    const rolloutIncluded = this.isRolloutIncluded(flag, input.tenantId);
    if (!rolloutIncluded) {
      return this.store(
        cacheKey,
        flag.rowVersion,
        this.result(input, false, 'rollout_excluded', false, false, flag.rowVersion),
      );
    }

    return this.store(
      cacheKey,
      flag.rowVersion,
      this.result(input, true, 'operational_allow', false, true, flag.rowVersion),
    );
  }

  private isRolloutIncluded(
    flag: {
      canonicalKey: string;
      targetType: string;
      rolloutPercentage: number;
      targets: Array<{ tenantId: string; mode: string }>;
    },
    tenantId: string,
  ): boolean {
    if (flag.targets.some((t) => t.mode === 'DENY' && t.tenantId === tenantId)) {
      return false;
    }
    switch (flag.targetType) {
      case 'TENANT_ALLOWLIST':
        return flag.targets.some((t) => t.mode === 'ALLOW' && t.tenantId === tenantId);
      case 'TENANT_DENYLIST':
        return true;
      case 'PERCENTAGE':
        return this.isTenantInPercentage(
          flag.canonicalKey,
          tenantId,
          flag.rolloutPercentage,
        );
      case 'GLOBAL':
      default:
        return true;
    }
  }

  private result(
    input: OperationalDecisionInput,
    allowed: boolean,
    explanationCode: OperationalExplanationCode,
    killSwitchActive: boolean,
    rolloutIncluded: boolean,
    flagRowVersion: number | null,
  ): OperationalDecisionResult {
    return {
      allowed,
      explanationCode,
      flagKey: input.flagKey,
      flagRowVersion,
      entitlementAllows: input.entitlementAllows,
      lifecycleDenied: input.lifecycleDenied,
      killSwitchActive,
      rolloutIncluded,
    };
  }

  private store(
    cacheKey: string,
    rowVersion: number,
    result: OperationalDecisionResult,
  ): OperationalDecisionResult {
    this.cache.set(cacheKey, { rowVersion, result, expiresAt: Date.now() + 30_000 });
    return result;
  }
}
