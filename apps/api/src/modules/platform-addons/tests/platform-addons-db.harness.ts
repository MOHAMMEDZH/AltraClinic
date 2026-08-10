/**
 * Safe isolated PostgreSQL harness for Step 15 Add-ons & Overrides tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { PlatformAddonsService } from '../application/platform-addons.service';
import { PlatformOverridesService } from '../application/platform-overrides.service';
import { CommercialCompositionService } from '../application/commercial-composition.service';
import { AddonIdempotencyService } from '../application/addon-idempotency.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import { PlatformSodService } from '../../auth/platform-rbac/platform-sod.service';
import type { PlatformAddonsAuditLog } from '../application/ports/addon-audit-log.port';
import type { PlatformAddonsConfig } from '../config/platform-addons.config';
import type { AddonTxFailureHook } from '../platform-addons.tokens';
import { FakeAddonAuditLog } from './support/fake-addon-audit-log';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export async function cleanupPlatformAddonsTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "platform_commercial_idempotency",
      "platform_commercial_override_effects",
      "platform_commercial_overrides",
      "platform_addon_version_applicability",
      "platform_addon_version_limit_effects",
      "platform_addon_version_entitlements",
      "platform_addon_version_translations",
      "platform_addon_versions",
      "platform_addon_translations",
      "platform_addons"
    RESTART IDENTITY CASCADE
  `);
}

export function createAddonsPrismaWrapper(prisma: PrismaClient) {
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

function defaultConfig(partial?: Partial<PlatformAddonsConfig>): PlatformAddonsConfig {
  return {
    enabled: partial?.enabled ?? true,
    mutationRateLimitPerMinute: partial?.mutationRateLimitPerMinute ?? 60,
    highImpactRateLimitPerMinute: partial?.highImpactRateLimitPerMinute ?? 30,
    readHeavyRateLimitPerMinute: partial?.readHeavyRateLimitPerMinute ?? 120,
  };
}

export function createAddonsService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: PlatformAddonsAuditLog;
  stepUpFresh?: boolean;
  config?: Partial<PlatformAddonsConfig>;
  failureHook?: AddonTxFailureHook;
}): PlatformAddonsService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async () =>
      opts.stepUpFresh === false
        ? { isStepUpFresh: () => false }
        : { isStepUpFresh: () => true },
    ),
  };
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 300 } as never);
  const wrapper = createAddonsPrismaWrapper(opts.prisma);
  const audit = opts.audit ?? new FakeAddonAuditLog();
  const idempotency = new AddonIdempotencyService(wrapper as never);
  return new PlatformAddonsService(
    wrapper as never,
    authz as never,
    audit,
    refreshRepo as never,
    assurance,
    idempotency,
    defaultConfig(opts.config),
    opts.failureHook,
  );
}

export function createOverridesService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: PlatformAddonsAuditLog;
  stepUpFresh?: boolean;
  config?: Partial<PlatformAddonsConfig>;
  failureHook?: AddonTxFailureHook;
}): PlatformOverridesService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async () =>
      opts.stepUpFresh === false
        ? { isStepUpFresh: () => false }
        : { isStepUpFresh: () => true },
    ),
  };
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 300 } as never);
  const sod = new PlatformSodService({} as never);
  const wrapper = createAddonsPrismaWrapper(opts.prisma);
  const audit = opts.audit ?? new FakeAddonAuditLog();
  const idempotency = new AddonIdempotencyService(wrapper as never);
  return new PlatformOverridesService(
    wrapper as never,
    authz as never,
    audit,
    refreshRepo as never,
    assurance,
    sod,
    idempotency,
    defaultConfig(opts.config),
    opts.failureHook,
  );
}

export function createCompositionService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  config?: Partial<PlatformAddonsConfig>;
}): CommercialCompositionService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const wrapper = createAddonsPrismaWrapper(opts.prisma);
  return new CommercialCompositionService(
    wrapper as never,
    authz as never,
    defaultConfig(opts.config),
  );
}
