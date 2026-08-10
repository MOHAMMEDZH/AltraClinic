/**
 * Safe isolated PostgreSQL harness for Step 12 healthcare catalog tests.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { HealthcareCatalogSeedService } from '../application/catalog-seed.service';
import { HealthcareCatalogService } from '../application/healthcare-catalog.service';
import { CatalogIdempotencyService } from '../application/catalog-idempotency.service';
import { loadPlatformHealthcareCatalogConfig } from '../config/platform-healthcare-catalog.config';
import { FakeCatalogAuditLog } from './support/fake-catalog-audit-log';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type { HealthcareCatalogAuditLog } from '../application/ports/catalog-audit-log.port';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export async function cleanupHealthcareCatalogTables(
  prisma: PrismaClient,
  url = DEFAULT_PLATFORM_DB_SECURITY_URL,
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(url);
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "healthcare_catalog_idempotency",
      "healthcare_catalog_compatibility_rules",
      "healthcare_catalog_aliases",
      "healthcare_catalog_translations",
      "healthcare_catalog_items"
    RESTART IDENTITY CASCADE
  `);
}

export function createCatalogPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        // Full catalog seed (68 items + translations/aliases/rules) exceeds Prisma's 5s default
        // under sequential Phase 47 DB load — match plans/addons harness timeouts.
        { maxWait: 15_000, timeout: 60_000 },
      ),
  };
}

export function createSeedService(prisma: PrismaClient): HealthcareCatalogSeedService {
  return new HealthcareCatalogSeedService(createCatalogPrismaWrapper(prisma) as never);
}

export function createCatalogService(opts: {
  prisma: PrismaClient;
  permissions: string[];
  audit?: HealthcareCatalogAuditLog;
  stepUpFresh?: boolean;
  refreshFindBySessionId?: jest.Mock;
  idempotency?: CatalogIdempotencyService;
}): HealthcareCatalogService {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => opts.permissions),
  };
  const refreshRepo = {
    findBySessionId:
      opts.refreshFindBySessionId ??
      jest.fn(async () =>
        opts.stepUpFresh === false
          ? { isStepUpFresh: () => false }
          : { isStepUpFresh: () => true },
      ),
  };
  const mfa = { stepUpSeconds: 300 };
  const assurance = new PlatformAssuranceService(mfa as never);

  return new HealthcareCatalogService(
    createCatalogPrismaWrapper(opts.prisma) as never,
    authz as never,
    loadPlatformHealthcareCatalogConfig(),
    opts.audit ?? new FakeCatalogAuditLog(),
    refreshRepo as never,
    assurance,
    opts.idempotency ??
      new CatalogIdempotencyService(createCatalogPrismaWrapper(opts.prisma) as never),
  );
}
