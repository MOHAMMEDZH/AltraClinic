/**
 * Flexible Step 20 — PostgreSQL test harness.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../../../infrastructure/prisma.service';
import { JwtClaimsVO, PLATFORM_TOKEN_AUDIENCE } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { createSubscriptionsPrismaWrapper } from '../../platform-subscriptions/tests/platform-subscriptions-db.harness';
import { FeatureFlagIdempotencyService } from '../application/feature-flag-idempotency.service';
import { FeatureFlagsSettingsAuditLog } from '../application/feature-flags-settings-audit.log';
import { FeatureFlagsSettingsRateLimitService } from '../application/feature-flags-settings-rate-limit.service';
import { FeatureFlagsSettingsService } from '../application/feature-flags-settings.service';
import { OperationalDecisionService } from '../application/operational-decision.service';
import {
  FEATURE_FLAG_PERMISSIONS,
  FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV,
  GLOBAL_SETTING_PERMISSIONS,
} from '../feature-flags-settings.constants';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV,
};

export const ALL_FF_PERMS = [
  ...Object.values(FEATURE_FLAG_PERMISSIONS),
  ...Object.values(GLOBAL_SETTING_PERMISSIONS),
];

export function createHybridPrisma(prisma: PrismaClient): PrismaService {
  return Object.assign(prisma, createSubscriptionsPrismaWrapper(prisma)) as unknown as PrismaService;
}

export function enableFfFlag(): () => void {
  const prev = process.env.FEATURE_FLAGS_SETTINGS_ENABLED;
  process.env.FEATURE_FLAGS_SETTINGS_ENABLED = 'true';
  return () => {
    if (prev === undefined) delete process.env.FEATURE_FLAGS_SETTINGS_ENABLED;
    else process.env.FEATURE_FLAGS_SETTINGS_ENABLED = prev;
  };
}

export function clearFfFailureInjection(): void {
  delete process.env[FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV];
}

export function setFfFailureInjection(point: string): void {
  // Selector alone is insufficient: production services require NODE_ENV === 'test'.
  process.env[FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV] = point;
}

export function platformClaims(sub: string, sessionId: string): JwtClaimsVO {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: PLATFORM_TOKEN_AUDIENCE,
    iss: 'booking-platform',
  });
}

export async function cleanupFfTables(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_feature_flag_idempotency",
      "platform_global_setting_idempotency",
      "platform_feature_flag_history",
      "platform_global_setting_history",
      "platform_feature_flag_targets",
      "platform_feature_flags",
      "platform_global_settings"
    RESTART IDENTITY CASCADE
  `);
}

export type FfStack = {
  service: FeatureFlagsSettingsService;
  operational: OperationalDecisionService;
  audit: FeatureFlagsSettingsAuditLog;
  permissions: Set<string>;
  setStepUpFresh: (fresh: boolean) => void;
  wrapped: PrismaService;
};

export function createFfStack(
  prisma: PrismaClient,
  opts: { permissions?: string[]; stepUpFresh?: boolean } = {},
): FfStack {
  const wrapped = createHybridPrisma(prisma);
  const permissions = new Set(opts.permissions ?? ALL_FF_PERMS);
  let stepUpFresh = opts.stepUpFresh !== false;
  const audit = new FeatureFlagsSettingsAuditLog();
  const operational = new OperationalDecisionService(wrapped);
  const idempotency = new FeatureFlagIdempotencyService(wrapped);
  const rateLimit = new FeatureFlagsSettingsRateLimitService();

  const assurance = {
    requireStepUp: () => {
      if (!stepUpFresh) {
        const { ForbiddenException } = require('@nestjs/common');
        throw new ForbiddenException({
          code: 'PLATFORM_STEP_UP_REQUIRED',
          message: 'Step-up verification is required for this action.',
        });
      }
    },
  };

  const platformSessions = {
    findBySessionId: async (sessionId: string) =>
      sessionId
        ? { sessionId, stepUpVerifiedAt: stepUpFresh ? new Date() : null }
        : null,
  };

  const service = new FeatureFlagsSettingsService(
    wrapped,
    idempotency,
    audit,
    operational,
    rateLimit,
    assurance as never,
    platformSessions as never,
  );

  return {
    service,
    operational,
    audit,
    permissions,
    setStepUpFresh: (fresh: boolean) => {
      stepUpFresh = fresh;
    },
    wrapped,
  };
}

export async function seedActiveFlag(
  prisma: PrismaClient,
  actorId: string,
  opts: {
    key?: string;
    effect?: 'KILL_SWITCH_DENY' | 'ROLLOUT_ALLOW_FOR_ENTITLED' | 'OPERATIONAL_ENABLEMENT';
    targetType?: 'GLOBAL' | 'TENANT_ALLOWLIST' | 'TENANT_DENYLIST' | 'PERCENTAGE';
    rolloutPercentage?: number;
    killSwitchActive?: boolean;
  } = {},
) {
  const key = opts.key ?? `ops.test.${randomUUID().slice(0, 8)}`;
  return prisma.platformFeatureFlag.create({
    data: {
      canonicalKey: key,
      displayName: key,
      description: 'test flag',
      ownerTeam: 'platform-ops',
      category: 'test',
      effect: opts.effect ?? 'ROLLOUT_ALLOW_FOR_ENTITLED',
      status: 'ACTIVE',
      killSwitchActive: opts.killSwitchActive ?? false,
      targetType: opts.targetType ?? 'GLOBAL',
      rolloutPercentage: opts.rolloutPercentage ?? 100,
      createdByPlatformUserId: actorId,
      updatedByPlatformUserId: actorId,
    },
  });
}

export async function seedSetting(
  prisma: PrismaClient,
  actorId: string,
  opts: { key?: string; highImpact?: boolean } = {},
) {
  const key = opts.key ?? `setting.test.${randomUUID().slice(0, 8)}`;
  return prisma.platformGlobalSetting.create({
    data: {
      canonicalKey: key,
      displayName: key,
      description: 'test setting',
      ownerTeam: 'platform-ops',
      valueKind: 'BOOLEAN',
      safeValueJson: { enabled: false },
      highImpact: opts.highImpact ?? false,
      createdByPlatformUserId: actorId,
      updatedByPlatformUserId: actorId,
    },
  });
}
