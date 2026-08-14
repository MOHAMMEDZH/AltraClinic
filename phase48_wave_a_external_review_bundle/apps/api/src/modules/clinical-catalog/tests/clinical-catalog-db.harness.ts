/**
 * Wave A clinical catalog PostgreSQL test harness.
 */
import { PrismaClient } from '@prisma/client';
import {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from '../../auth/tests/platform-db-security.harness';
import { ClinicalCatalogService } from '../application/clinical-catalog.service';
import { ClinicalPriceVersionService } from '../application/clinical-price-version.service';
import { TenantServiceConfigService } from '../application/tenant-service-config.service';
import { FakeClinicalCatalogAuditLog } from './support/fake-clinical-catalog-audit-log';

export {
  assertSafePlatformTestDatabaseUrl,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
};

export function createClinicalPrismaWrapper(prisma: PrismaClient) {
  return {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { maxWait: 20_000, timeout: 60_000 },
      ),
  };
}

export function createTenantContextMock(tenantId: string) {
  return {
    resolve: jest.fn(async () => ({ tenantId, branchId: null, locale: 'en' })),
  };
}

export function createClinicalCatalogService(opts: {
  prisma: PrismaClient;
  tenantId?: string | null;
  audit?: FakeClinicalCatalogAuditLog;
}) {
  const wrapper = createClinicalPrismaWrapper(opts.prisma);
  const tenantContext = createTenantContextMock(opts.tenantId ?? '00000000-0000-4000-8000-000000000001');
  const audit = opts.audit ?? new FakeClinicalCatalogAuditLog();
  return {
    service: new ClinicalCatalogService(wrapper as never, tenantContext as never, audit as never),
    prices: new ClinicalPriceVersionService(wrapper as never, audit as never),
    configs: new TenantServiceConfigService(
      wrapper as never,
      tenantContext as never,
      audit as never,
    ),
    tenantContext,
    audit,
    wrapper,
  };
}

export async function cleanupWaveAFixtures(
  prisma: PrismaClient,
  tenantIds: string[],
): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
    await tx.legacyClinicalPriceMapping.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.legacyClinicalServiceMapping.deleteMany({
      where: { OR: [{ tenantId: { in: tenantIds } }, { tenantId: null }] },
    });
    await tx.clinicalServicePriceVersion.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.tenantServiceConfiguration.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.tenantServicePresentationOverride.deleteMany({
      where: { tenantId: { in: tenantIds } },
    });
    const customs = await tx.canonicalClinicalServiceDefinition.findMany({
      where: { tenantId: { in: tenantIds } },
      select: { id: true },
    });
    const ids = customs.map((c) => c.id);
    if (ids.length) {
      await tx.clinicalServiceAlias.deleteMany({ where: { clinicalServiceId: { in: ids } } });
      await tx.clinicalServiceTranslation.deleteMany({ where: { clinicalServiceId: { in: ids } } });
      await tx.canonicalClinicalServiceDefinition.deleteMany({ where: { id: { in: ids } } });
    }
    await tx.branch.deleteMany({ where: { tenantId: { in: tenantIds } } });
    await tx.tenant.deleteMany({ where: { id: { in: tenantIds } } });
  });
}
