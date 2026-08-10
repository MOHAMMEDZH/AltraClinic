/**
 * Release 47 Step 10 — PostgreSQL reconciliation for Platform Dashboard metrics.
 */
import { PrismaClient } from '@prisma/client';
import { PlatformDashboardService } from '../application/platform-dashboard.service';
import { loadPlatformDashboardConfig } from '../config/platform-dashboard.config';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import type { MetricDto } from '../application/dto/platform-dashboard.dto';
import { resolveTenantTrialing } from '../application/resolvers/tenant.resolvers';
import { resolveFacilityTypeDistribution } from '../application/resolvers/facility-type.resolver';
import type { ResolvedMetricValue } from '../application/resolvers/resolver.types';
import {
  cleanupPlatformDashboardTables,
  createDashboardPrismaWrapper,
  createPlatformDbSecurityClient,
  platformDbSecurityEnabled,
  seedDashboardFixtures,
  type DashboardFixtureExpectations,
} from './platform-dashboard-db.harness';

const ALL_DASHBOARD_PERMISSIONS = [
  'tenant.view',
  'plan.view',
  'subscription.view',
  'plan-version.view',
  'specialty.view',
  'addon.view',
  'override.view',
  'entitlement.view',
  'limit.view',
  'operations.view',
  'audit.view',
  'sales-report.view',
];

const CLAIMS = { sub: 'reconcile-user-1' } as unknown as JwtClaimsVO;

const run = platformDbSecurityEnabled();

function byId(metrics: MetricDto[], id: string): MetricDto {
  const found = metrics.find((m) => m.id === id);
  if (!found) throw new Error(`metric ${id} not found`);
  return found;
}

function breakdownCount(metric: MetricDto, key: string): number {
  return metric.breakdown?.find((b) => b.key === key)?.count ?? 0;
}

function resolvedBreakdownCount(result: ResolvedMetricValue, key: string): number {
  return result.breakdown?.find((b) => b.key === key)?.count ?? 0;
}

describe('platform dashboard reconciliation (postgres)', () => {
  let prisma: PrismaClient;
  let service: PlatformDashboardService;
  let expectations: DashboardFixtureExpectations;
  let facilityBaseline: ResolvedMetricValue;

  beforeAll(async () => {
    if (!run) return;
    process.env.ALLOW_TEST_DATABASE_RESET = 'true';
    process.env.RUN_PLATFORM_DB_SECURITY = 'true';
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await cleanupPlatformDashboardTables(prisma);
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformDashboardTables(prisma);
    facilityBaseline = await resolveFacilityTypeDistribution(prisma as never);
    const seeded = await seedDashboardFixtures(prisma);
    expectations = seeded.expectations;

    const authz = {
      resolveEffectivePermissions: jest.fn(async () => ALL_DASHBOARD_PERMISSIONS),
    };
    service = new PlatformDashboardService(
      createDashboardPrismaWrapper(prisma) as never,
      authz as never,
      loadPlatformDashboardConfig(),
    );
  });

  (run ? it : it.skip)('reconciles tenant.total and tenant.byStatus (ARCHIVED included in total)', async () => {
    const dto = await service.getDashboard(CLAIMS);

    expect(byId(dto.metrics, 'tenant.total').value).toBe(expectations.platformTenantTotal);
    expect(byId(dto.metrics, 'tenant.total').status).toBe('available');

    const byStatus = byId(dto.metrics, 'tenant.byStatus');
    expect(byStatus.value).toBe(expectations.platformTenantTotal);
    expect(breakdownCount(byStatus, 'PROVISIONING')).toBe(expectations.tenantByStatus.PROVISIONING);
    expect(breakdownCount(byStatus, 'ACTIVE')).toBe(expectations.tenantByStatus.ACTIVE);
    expect(breakdownCount(byStatus, 'SUSPENDED')).toBe(expectations.tenantByStatus.SUSPENDED);
    expect(breakdownCount(byStatus, 'ARCHIVED')).toBe(expectations.tenantByStatus.ARCHIVED);
  });

  (run ? it : it.skip)('reconciles tenant.trialing — ARCHIVED excluded even with future trialEndsAt', async () => {
    const dto = await service.getDashboard(CLAIMS);
    expect(byId(dto.metrics, 'tenant.trialing').value).toBe(expectations.tenantTrialing);

    const direct = await resolveTenantTrialing(prisma as never);
    expect(direct.value).toBe(expectations.tenantTrialing);

    const sqlCount = await prisma.platformTenant.count({
      where: {
        trialEndsAt: { not: null, gt: new Date() },
        status: { not: 'ARCHIVED' },
      },
    });
    expect(sqlCount).toBe(expectations.tenantTrialing);
  });

  (run ? it : it.skip)('tenant.trialing boundaries use a controlled clock (gt now; equal excluded)', async () => {
    const fixedNow = new Date('2030-06-15T12:00:00.000Z');
    await cleanupPlatformDashboardTables(prisma);

    const provisionedBy = '00000000-0000-4000-8000-000000000099';
    async function seedTrialRow(
      slug: string,
      status: 'ACTIVE' | 'SUSPENDED' | 'ARCHIVED',
      trialEndsAt: Date | null,
    ) {
      const tenant = await prisma.tenant.create({
        data: {
          name: `PD Boundary ${slug}`,
          slug: `pd-fixt-boundary-${slug}`,
          features: {},
        },
      });
      await prisma.platformTenant.create({
        data: {
          tenantId: tenant.id,
          displayName: `Boundary ${slug}`,
          region: 'ME_SOUTH',
          plan: 'LITE',
          status,
          provisionedBy,
          trialEndsAt,
        },
      });
    }

    await seedTrialRow('before', 'ACTIVE', new Date(fixedNow.getTime() - 1));
    await seedTrialRow('exact', 'ACTIVE', new Date(fixedNow.getTime()));
    await seedTrialRow('after', 'ACTIVE', new Date(fixedNow.getTime() + 1));
    await seedTrialRow('arch-future', 'ARCHIVED', new Date(fixedNow.getTime() + 86_400_000));
    await seedTrialRow('null', 'ACTIVE', null);
    await seedTrialRow('susp-future', 'SUSPENDED', new Date(fixedNow.getTime() + 86_400_000));

    const direct = await resolveTenantTrialing(prisma as never, { now: fixedNow });
    // Included: after (ACTIVE) + susp-future. Excluded: before, exact (==), null, ARCHIVED.
    expect(direct.value).toBe(2);

    const sqlCount = await prisma.platformTenant.count({
      where: {
        trialEndsAt: { not: null, gt: fixedNow },
        status: { not: 'ARCHIVED' },
      },
    });
    expect(sqlCount).toBe(2);
  });

  (run ? it : it.skip)('reconciles legacyPlan.assignment across LITE/PRO/ENTERPRISE', async () => {
    const dto = await service.getDashboard(CLAIMS);
    const legacy = byId(dto.metrics, 'legacyPlan.assignment');

    expect(legacy.value).toBe(expectations.platformTenantTotal);
    expect(breakdownCount(legacy, 'LITE')).toBe(expectations.legacyPlan.LITE);
    expect(breakdownCount(legacy, 'PRO')).toBe(expectations.legacyPlan.PRO);
    expect(breakdownCount(legacy, 'ENTERPRISE')).toBe(expectations.legacyPlan.ENTERPRISE);
  });

  (run ? it : it.skip)('reconciles subscription.byStatus — all rows counted (duplicate tenant ok)', async () => {
    const dto = await service.getDashboard(CLAIMS);
    const subs = byId(dto.metrics, 'subscription.byStatus');

    expect(subs.value).toBe(expectations.subscriptionTotal);
    expect(breakdownCount(subs, 'TRIAL')).toBe(expectations.subscriptionByStatus.TRIAL);
    expect(breakdownCount(subs, 'ACTIVE')).toBe(expectations.subscriptionByStatus.ACTIVE);
    expect(breakdownCount(subs, 'SUSPENDED')).toBe(expectations.subscriptionByStatus.SUSPENDED);
    expect(breakdownCount(subs, 'EXPIRED')).toBe(expectations.subscriptionByStatus.EXPIRED);
    expect(breakdownCount(subs, 'CANCELLED')).toBe(expectations.subscriptionByStatus.CANCELLED);
  });

  (run ? it : it.skip)('reconciles facilityType.distribution buckets via raw resolver', async () => {
    const dto = await service.getDashboard(CLAIMS);
    const facility = byId(dto.metrics, 'facilityType.distribution');
    const direct = await resolveFacilityTypeDistribution(prisma as never);

    const expectedTotal = (facilityBaseline.value ?? 0) + expectations.facilityTypeDeltaTotal;
    expect(facility.value).toBe(expectedTotal);
    expect(direct.value).toBe(expectedTotal);

    for (const bucket of ['medical', 'dental', 'beauty', 'multi', 'unclassified'] as const) {
      const expected =
        resolvedBreakdownCount(facilityBaseline, bucket) + expectations.facilityTypeDelta[bucket];
      expect(breakdownCount(facility, bucket)).toBe(expected);
      expect(resolvedBreakdownCount(direct, bucket)).toBe(expected);
    }
  });

  (run ? it : it.skip)('permission_limited when permissions=[] — resolvers never hit the database', async () => {
    const countSpy = jest.spyOn(prisma.platformTenant, 'count');
    const groupBySpy = jest.spyOn(prisma.platformSubscription, 'groupBy');
    const querySpy = jest.spyOn(prisma, '$queryRaw');

    const authz = { resolveEffectivePermissions: jest.fn(async () => []) };
    const lockedService = new PlatformDashboardService(
      createDashboardPrismaWrapper(prisma) as never,
      authz as never,
      loadPlatformDashboardConfig(),
    );

    const dto = await lockedService.getDashboard(CLAIMS);

    const restricted = dto.metrics.filter((m) =>
      ['tenant.total', 'tenant.byStatus', 'tenant.trialing', 'subscription.byStatus', 'legacyPlan.assignment', 'facilityType.distribution'].includes(m.id),
    );
    expect(restricted.every((m) => m.status === 'permission_limited')).toBe(true);
    expect(restricted.every((m) => m.value === null)).toBe(true);
    expect(countSpy).not.toHaveBeenCalled();
    expect(groupBySpy).not.toHaveBeenCalled();
    expect(querySpy).not.toHaveBeenCalled();

    countSpy.mockRestore();
    groupBySpy.mockRestore();
    querySpy.mockRestore();
  });
});
