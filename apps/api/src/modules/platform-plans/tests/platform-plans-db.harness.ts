/**
 * Safe isolated PostgreSQL harness for Step 13/14 Platform Plans tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  withPlatformDbRetry,
} from '../../auth/tests/platform-db-security.harness';
import { PlatformPlansSeedService } from '../application/plan-seed.service';
import { PlatformPlansService } from '../application/platform-plans.service';
import { PlanEntitlementsService } from '../application/plan-entitlements.service';
import { PlanIdempotencyService } from '../application/plan-idempotency.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type { PlatformPlansAuditLog } from '../application/ports/plan-audit-log.port';
import type { PlatformPlansConfig } from '../config/platform-plans.config';
import type { PlanTxFailureHook } from '../platform-plans.tokens';
import { FakePlanAuditLog } from './support/fake-plan-audit-log';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export async function cleanupPlatformPlansTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await withPlatformDbRetry(prisma, async () => {
    await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_plan_idempotency",
      "platform_plan_version_entitlements",
      "platform_plan_version_limits",
      "platform_plan_version_translations",
      "platform_plan_versions",
      "platform_plan_aliases",
      "platform_plan_translations",
      "platform_plans"
    RESTART IDENTITY CASCADE
  `);
  });
}

export function createPlansPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { maxWait: 15_000, timeout: 60_000 },
      ),
  };
}

export function createPlansSeedService(prisma: PrismaClient): PlatformPlansSeedService {
  return new PlatformPlansSeedService(createPlansPrismaWrapper(prisma) as never);
}

export function createEntitlementsService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: PlatformPlansAuditLog;
  config?: Partial<PlatformPlansConfig>;
  failureHook?: PlanTxFailureHook;
}): PlanEntitlementsService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const wrapper = createPlansPrismaWrapper(opts.prisma);
  const config: PlatformPlansConfig = {
    enabled: opts.config?.enabled ?? true,
    mutationRateLimitPerMinute: opts.config?.mutationRateLimitPerMinute ?? 60,
    highImpactRateLimitPerMinute: opts.config?.highImpactRateLimitPerMinute ?? 30,
    readHeavyRateLimitPerMinute: opts.config?.readHeavyRateLimitPerMinute ?? 120,
  };
  return new PlanEntitlementsService(
    wrapper as never,
    authz as never,
    opts.audit ?? new FakePlanAuditLog(),
    new PlanIdempotencyService(wrapper as never),
    config,
    opts.failureHook,
  );
}

export function createPlansService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: PlatformPlansAuditLog;
  stepUpFresh?: boolean;
  stepUpBySessionId?: Record<string, boolean>;
  config?: Partial<PlatformPlansConfig>;
  failureHook?: PlanTxFailureHook;
}): PlatformPlansService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async (sessionId: string) => {
      if (opts.stepUpBySessionId) {
        const fresh = opts.stepUpBySessionId[sessionId] ?? false;
        return { isStepUpFresh: () => fresh };
      }
      return opts.stepUpFresh === false
        ? { isStepUpFresh: () => false }
        : { isStepUpFresh: () => true };
    }),
  };
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 300 } as never);
  const wrapper = createPlansPrismaWrapper(opts.prisma);
  const config: PlatformPlansConfig = {
    enabled: opts.config?.enabled ?? true,
    mutationRateLimitPerMinute: opts.config?.mutationRateLimitPerMinute ?? 60,
    highImpactRateLimitPerMinute: opts.config?.highImpactRateLimitPerMinute ?? 30,
    readHeavyRateLimitPerMinute: opts.config?.readHeavyRateLimitPerMinute ?? 120,
  };
  const audit = opts.audit ?? new FakePlanAuditLog();
  const idempotency = new PlanIdempotencyService(wrapper as never);
  const entitlements = new PlanEntitlementsService(
    wrapper as never,
    authz as never,
    audit,
    idempotency,
    config,
    opts.failureHook,
  );
  return new PlatformPlansService(
    wrapper as never,
    authz as never,
    audit,
    refreshRepo as never,
    assurance,
    idempotency,
    entitlements,
    config,
    opts.failureHook,
  );
}
