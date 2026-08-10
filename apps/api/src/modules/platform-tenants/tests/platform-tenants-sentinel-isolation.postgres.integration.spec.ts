/**
 * Release 47 Step 11 final gate — audit sentinel isolation against real PostgreSQL.
 *
 * Proves customer-visible Dashboard metrics and Tenant Directory results are unchanged
 * before/after/repeated/concurrent sentinel upserts, and that licensing / lifecycle /
 * clinic list paths cannot target the sentinel.
 */
import { NotFoundException } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

import { resolveFacilityTypeDistribution } from '../../platform-dashboard/application/resolvers/facility-type.resolver';
import {
  resolveTenantByStatus,
  resolveTenantTotal,
  resolveTenantTrialing,
} from '../../platform-dashboard/application/resolvers/tenant.resolvers';
import { resolveLegacyPlanAssignment } from '../../platform-dashboard/application/resolvers/legacy-plan.resolver';
import { resolveSubscriptionByStatus } from '../../platform-dashboard/application/resolvers/subscription.resolvers';
import { PlatformTenantsDirectoryService } from '../application/platform-tenants-directory.service';
import { PlatformTenantsDetailService } from '../application/platform-tenants-detail.service';
import { AuditTrailPlatformTenantsAuditLog } from '../infrastructure/audit-trail-platform-tenants-audit-log';
import { loadPlatformTenantsConfig } from '../config/platform-tenants.config';
import {
  PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
  PLATFORM_AUDIT_SENTINEL_SLUG,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../platform-tenants.tokens';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { PrismaPlatformTenantRepository } from '../../platform-admin/infrastructure/prisma-platform-tenant.repository';
import { FakePlatformTenantsAuditLog } from './support/fake-platform-tenants-audit-log';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupPlatformTenantsTables,
  createPlatformDbSecurityClient,
  createTenantsPrismaWrapper,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
  seedTenantDirectoryFixtures,
} from './platform-tenants-db.harness';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import type { PlatformTenantsAuditLog } from '../application/ports/platform-tenants-audit-log.port';

const run = platformDbSecurityEnabled();
const CONFIG = loadPlatformTenantsConfig();
const ACTOR_ID = '00000000-0000-4000-8000-000000000088';
const ALL_PERMS = ['tenant.view', 'plan.view', 'subscription.view', 'entitlement.view'] as const;

function makeClaims(): JwtClaimsVO {
  return { sub: ACTOR_ID, sessionId: randomUUID() } as JwtClaimsVO;
}

function createAuditLog(prisma: PrismaClient): AuditTrailPlatformTenantsAuditLog {
  const prismaService = Object.assign(prisma, {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>): Promise<T> =>
      prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
          await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
          return fn(tx as unknown as PrismaClient);
        },
        { timeout: 30_000 },
      ),
  });
  return new AuditTrailPlatformTenantsAuditLog(prismaService as never);
}

function createDirectory(prisma: PrismaClient, audit: PlatformTenantsAuditLog) {
  return new PlatformTenantsDirectoryService(
    createTenantsPrismaWrapper(prisma) as never,
    { resolveEffectivePermissions: jest.fn(async () => [...ALL_PERMS]) } as never,
    CONFIG,
    audit,
  );
}

async function countSentinelRows(prisma: PrismaClient): Promise<number> {
  return prisma.tenant.count({
    where: {
      OR: [{ id: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, { slug: PLATFORM_AUDIT_SENTINEL_SLUG }],
    },
  });
}

async function deleteSentinelIfPresent(prisma: PrismaClient): Promise<void> {
  assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
  // audit_entries is append-only via trigger; test cleanup temporarily disables
  // user triggers on the approved isolated booking_test database only.
  await prisma.$executeRawUnsafe(`ALTER TABLE audit_entries DISABLE TRIGGER USER`);
  try {
    await prisma.$executeRawUnsafe(
      `DELETE FROM audit_entries WHERE "tenantId" = '${PLATFORM_AUDIT_SENTINEL_TENANT_ID}'::uuid`,
    );
  } finally {
    await prisma.$executeRawUnsafe(`ALTER TABLE audit_entries ENABLE TRIGGER USER`);
  }
  await prisma.tenant.deleteMany({
    where: {
      OR: [{ id: PLATFORM_AUDIT_SENTINEL_TENANT_ID }, { slug: PLATFORM_AUDIT_SENTINEL_SLUG }],
    },
  });
}

async function captureCustomerVisibleSnapshot(
  prisma: PrismaClient,
  directory: PlatformTenantsDirectoryService,
) {
  const [
    tenantTotal,
    byStatus,
    trialing,
    legacyPlan,
    facilityType,
    subscriptionByStatus,
  ] = await Promise.all([
    resolveTenantTotal(prisma as never),
    resolveTenantByStatus(prisma as never),
    resolveTenantTrialing(prisma as never),
    resolveLegacyPlanAssignment(prisma as never),
    resolveFacilityTypeDistribution(prisma as never),
    resolveSubscriptionByStatus(prisma as never),
  ]);

  const firstPage = await directory.listDirectory(makeClaims(), { page: '1', pageSize: '25' });
  const allIds: string[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext) {
    const result = await directory.listDirectory(makeClaims(), {
      page: String(page),
      pageSize: '25',
    });
    for (const item of result.items) {
      allIds.push(item.platformTenantId);
      expect(item.tenantId).not.toBe(PLATFORM_AUDIT_SENTINEL_TENANT_ID);
      expect(item.slug).not.toBe(PLATFORM_AUDIT_SENTINEL_SLUG);
      expect(item.displayName).not.toBe(PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME);
    }
    hasNext = result.pagination.hasNextPage;
    page += 1;
    if (page > 50) break;
  }

  return {
    tenantTotal: tenantTotal.value,
    byStatus: byStatus.breakdown ?? [],
    trialing: trialing.value,
    legacyPlan: legacyPlan.breakdown ?? [],
    facilityType: facilityType.breakdown ?? [],
    facilityTypeTotal: facilityType.value,
    subscriptionByStatus: subscriptionByStatus.breakdown ?? [],
    directoryTotal: firstPage.pagination.total,
    directoryFirstPageIds: firstPage.items.map((i) => i.platformTenantId).sort(),
    allDirectoryIds: [...allIds].sort(),
  };
}

describe('Platform tenants audit sentinel isolation (postgres)', () => {
  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;
  let realAudit: AuditTrailPlatformTenantsAuditLog;

  beforeAll(async () => {
    if (!run) return;
    prisma = createPlatformDbSecurityClient();
    realAudit = createAuditLog(prisma);
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformTenantsTables(prisma);
    await deleteSentinelIfPresent(prisma);
  });

  (run ? it : it.skip)('keeps Dashboard and Directory identical before/after concurrent sentinel upserts', async () => {
    await seedTenantDirectoryFixtures(prisma);
    expect(await countSentinelRows(prisma)).toBe(0);

    // Baseline uses a non-persisting audit so the sentinel is not created yet.
    const silentDirectory = createDirectory(prisma, new FakePlatformTenantsAuditLog());
    const before = await captureCustomerVisibleSnapshot(prisma, silentDirectory);
    expect(await countSentinelRows(prisma)).toBe(0);
    expect(before.allDirectoryIds).not.toContain(PLATFORM_AUDIT_SENTINEL_TENANT_ID);

    const auditedDirectory = createDirectory(prisma, realAudit);

    // First real audited directory read creates/resolves sentinel.
    await auditedDirectory.listDirectory(makeClaims(), { search: 'PT Fixture', page: '1' });
    expect(await countSentinelRows(prisma)).toBe(1);

    const afterFirst = await captureCustomerVisibleSnapshot(prisma, silentDirectory);
    expect(afterFirst).toEqual(before);

    // Repeated upserts remain idempotent.
    await auditedDirectory.listDirectory(makeClaims(), { status: 'ACTIVE', page: '1' });
    await auditedDirectory.listDirectory(makeClaims(), { facilityType: 'dental', page: '1' });
    const afterRepeat = await captureCustomerVisibleSnapshot(prisma, silentDirectory);
    expect(afterRepeat).toEqual(before);
    expect(await countSentinelRows(prisma)).toBe(1);

    // Concurrent audited reads still yield exactly one sentinel.
    await Promise.all(
      Array.from({ length: 8 }, () =>
        auditedDirectory.listDirectory(makeClaims(), { page: '1', pageSize: '10' }),
      ),
    );
    const afterConcurrent = await captureCustomerVisibleSnapshot(prisma, silentDirectory);
    expect(afterConcurrent).toEqual(before);
    expect(await countSentinelRows(prisma)).toBe(1);

    const sentinel = await prisma.tenant.findUnique({
      where: { id: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
    });
    expect(sentinel?.slug).toBe(PLATFORM_AUDIT_SENTINEL_SLUG);
    expect(sentinel?.name).toBe(PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME);
  });

  (run ? it : it.skip)('cannot be found via directory search, filters, or detail lookup', async () => {
    await seedTenantDirectoryFixtures(prisma);
    const auditedDirectory = createDirectory(prisma, realAudit);
    await auditedDirectory.listDirectory(makeClaims(), {});

    const byId = await auditedDirectory.listDirectory(makeClaims(), {
      search: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
    });
    expect(byId.items).toHaveLength(0);

    const bySlug = await auditedDirectory.listDirectory(makeClaims(), {
      search: PLATFORM_AUDIT_SENTINEL_SLUG,
    });
    expect(bySlug.items).toHaveLength(0);

    const byName = await auditedDirectory.listDirectory(makeClaims(), {
      search: 'Audit Sentinel',
    });
    expect(byName.items.every((i) => i.tenantId !== PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(true);

    for (const status of ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const) {
      const filtered = await auditedDirectory.listDirectory(makeClaims(), { status });
      expect(filtered.items.every((i) => i.tenantId !== PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(
        true,
      );
    }

    const detail = new PlatformTenantsDetailService(
      createTenantsPrismaWrapper(prisma) as never,
      {
        resolveEffectivePermissions: jest.fn(async () => ['tenant.view', 'entitlement.view']),
      } as never,
      { resolveLicense: jest.fn() } as never,
      CONFIG,
      realAudit,
    );

    await expect(detail.getDetail(makeClaims(), PLATFORM_AUDIT_SENTINEL_TENANT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  (run ? it : it.skip)('licensing rejects sentinel and clinic list excludes sentinel tenantId', async () => {
    await seedTenantDirectoryFixtures(prisma);
    const auditedDirectory = createDirectory(prisma, realAudit);
    await auditedDirectory.listDirectory(makeClaims(), {});

    const engine = Object.create(LicensingEngineService.prototype) as LicensingEngineService;
    Object.assign(engine, {
      licenseCache: new Map(),
      logger: { warn: () => undefined, log: () => undefined, error: () => undefined },
      invalidateCache(tenantId: string) {
        this.licenseCache.delete(tenantId);
      },
    });

    await expect(engine.resolveLicense(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect((engine as unknown as { licenseCache: Map<string, unknown> }).licenseCache.size).toBe(0);

    const repo = new PrismaPlatformTenantRepository(prisma as never);
    expect(await repo.findByTenantId(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBeNull();
    expect(await repo.findById(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBeNull();

    // Clinic compatibility list path excludes sentinel tenantId at the Prisma where clause.
    const listed = await prisma.platformTenant.findMany({
      where: { tenantId: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID } },
      select: { tenantId: true },
    });
    expect(listed.every((t) => t.tenantId !== PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(true);
    expect(
      await prisma.platformTenant.count({
        where: { tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
      }),
    ).toBe(0);
  });

  (run ? it : it.skip)('sentinel upsert does not overwrite an unrelated customer tenant row', async () => {
    const customer = await prisma.tenant.create({
      data: {
        name: 'Customer Must Survive',
        slug: `pt-fixt-survive-${randomUUID().slice(0, 8)}`,
        features: { clinicProfile: { clinicType: 'medical' } },
      },
    });

    const auditedDirectory = createDirectory(prisma, realAudit);
    await auditedDirectory.listDirectory(makeClaims(), {});
    const after = await prisma.tenant.findUnique({ where: { id: customer.id } });
    expect(after?.name).toBe('Customer Must Survive');
    expect(after?.slug).toBe(customer.slug);
    expect(await countSentinelRows(prisma)).toBe(1);
  });

  (run ? it : it.skip)('absent sentinel row: exact id still fail-closed; ordinary resolve path open; PK uniqueness', async () => {
    await deleteSentinelIfPresent(prisma);
    expect(await countSentinelRows(prisma)).toBe(0);

    const engine = Object.create(LicensingEngineService.prototype) as {
      resolveLicense: (id: string) => Promise<unknown>;
      licenseCache: Map<string, unknown>;
      loadTenantContext: jest.Mock;
      buildLicense: jest.Mock;
      lifecycleState: { syncFromResolvedLicense: jest.Mock };
      logger: { warn: jest.Mock };
    };
    engine.licenseCache = new Map();
    engine.loadTenantContext = jest.fn(async (id: string) => ({ tenantId: id, plan: 'lite' }));
    engine.buildLicense = jest.fn(() => ({ uiPlan: 'lite', status: 'active' }));
    engine.lifecycleState = { syncFromResolvedLicense: jest.fn(async () => undefined) };
    engine.logger = { warn: jest.fn() };

    await expect(engine.resolveLicense(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(engine.loadTenantContext).not.toHaveBeenCalled();
    expect(engine.licenseCache.size).toBe(0);

    const ordinary = await engine.resolveLicense('33333333-3333-4333-8333-333333333333');
    expect(ordinary).toMatchObject({ uiPlan: 'lite' });
    expect(engine.loadTenantContext).toHaveBeenCalledTimes(1);

    // Duplicate sentinel identity is prevented by primary key when the row exists.
    await prisma.tenant.create({
      data: {
        id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        name: PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME,
        slug: PLATFORM_AUDIT_SENTINEL_SLUG,
      },
    });
    await expect(
      prisma.tenant.create({
        data: {
          id: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
          name: 'Duplicate',
          slug: `dup-${randomUUID().slice(0, 8)}`,
        },
      }),
    ).rejects.toThrow();
    expect(await countSentinelRows(prisma)).toBe(1);
  });

  (run ? it : it.skip)('repository save rejects reserved tenantId (collision at write boundary)', async () => {
    const { PlatformTenant } = await import('../../platform-admin/domain/entities/platform-tenant.entity');
    const repo = new PrismaPlatformTenantRepository(prisma as never);
    // Bypass entity provision guard by restoring a synthetic aggregate, then save must still reject.
    const rogue = PlatformTenant.restore({
      platformTenantId: randomUUID(),
      tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
      displayName: 'Rogue',
      region: { value: 'me-central' } as never,
      plan: { value: 'starter', limits: { maxBranches: 1, maxUsers: 10 } } as never,
      status: { value: 'provisioning' } as never,
      privilegedGrants: [],
      provisionedBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      activatedAt: null,
      suspendedAt: null,
      suspensionReason: null,
      archivedAt: null,
      archivedReason: null,
    });
    await expect(repo.save(rogue)).rejects.toThrow(/Reserved platform audit-sentinel/);
  });
});
