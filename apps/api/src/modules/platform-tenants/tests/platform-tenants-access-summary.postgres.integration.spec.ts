import { NotFoundException } from '@nestjs/common';
import { PrismaClient, type EntitlementPlan, type SubscriptionStatus } from '@prisma/client';
import { randomUUID } from 'crypto';

import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import { LicensingAuditService } from '../../subscription/application/services/licensing-audit.service';
import { LicensingLifecycleStateService } from '../../subscription/application/services/licensing-lifecycle-state.service';
import { UNLIMITED } from '../../subscription/domain/config/plan-limits.config';
import { PlatformTenantsDetailService } from '../application/platform-tenants-detail.service';
import { loadPlatformTenantsConfig } from '../config/platform-tenants.config';
import type { AccessSummaryDto } from '../application/dto/platform-tenants.dto';
import { FakePlatformTenantsAuditLog } from './support/fake-platform-tenants-audit-log';
import {
  cleanupPlatformTenantsTables,
  createPlatformDbSecurityClient,
  createTenantsPrismaWrapper,
  platformDbSecurityEnabled,
} from './platform-tenants-db.harness';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const run = platformDbSecurityEnabled();
const CLAIMS = { sub: 'pu-access-summary', sessionId: 'sess-access-summary' } as JwtClaimsVO;
const CONFIG = loadPlatformTenantsConfig();

async function cleanupAccessSummarySlugs(prisma: PrismaClient): Promise<void> {
  await prisma.tenant.deleteMany({
    where: { slug: { in: ['pt-acc-lite', 'pt-acc-pro', 'pt-acc-ent'] } },
  });
}

interface AccessSummaryFixture {
  platformTenantId: string;
  tenantId: string;
  plan: EntitlementPlan;
  subscriptionStatus: SubscriptionStatus;
}

function createLicensingEngine(prisma: PrismaClient): LicensingEngineService {
  const prismaWrapper = Object.assign(prisma, {
    withPlatformBypass: async <T>(fn: (client: PrismaClient) => Promise<T>) => fn(prisma),
  });
  const tenantSub = {
    getUsage: jest.fn(async () => ({
      users: 0,
      branches: 0,
      patients: 0,
      appointmentsThisMonth: 0,
      reportsThisMonth: 0,
      apiCallsToday: 0,
      storageGb: 0,
      smsThisMonth: 0,
      whatsappThisMonth: 0,
      emailThisMonth: 0,
      pushThisMonth: 0,
    })),
    resolveRequestedPlan: jest.fn((plan: string) => ({
      backendPlan: plan,
      platformPlan: 'growth',
      uiPlan: plan,
    })),
  };
  const audit = {
    recordLicenseEvent: jest.fn(async () => undefined),
  } as unknown as LicensingAuditService;
  const lifecycleState = {
    syncFromResolvedLicense: jest.fn(async () => undefined),
    persistKnownStatus: jest.fn(async () => undefined),
  } as unknown as LicensingLifecycleStateService;
  return new LicensingEngineService(
    prismaWrapper as never,
    tenantSub as never,
    audit,
    lifecycleState,
  );
}

function makeDetailService(
  prisma: PrismaClient,
  licensing: LicensingEngineService,
  permissions: string[] = ['tenant.view', 'entitlement.view'],
) {
  const audit = new FakePlatformTenantsAuditLog();
  const authz = { resolveEffectivePermissions: jest.fn(async () => permissions) };
  const service = new PlatformTenantsDetailService(
    createTenantsPrismaWrapper(prisma) as never,
    authz as never,
    licensing,
    CONFIG,
    audit,
  );
  return { service, audit };
}

async function seedAccessSummaryFixtures(prisma: PrismaClient): Promise<AccessSummaryFixture[]> {
  const seeds: Array<{ plan: EntitlementPlan; subscriptionStatus: SubscriptionStatus; slug: string }> = [
    { plan: 'LITE', subscriptionStatus: 'TRIAL', slug: 'pt-acc-lite' },
    { plan: 'PRO', subscriptionStatus: 'ACTIVE', slug: 'pt-acc-pro' },
    { plan: 'ENTERPRISE', subscriptionStatus: 'SUSPENDED', slug: 'pt-acc-ent' },
  ];
  const fixtures: AccessSummaryFixture[] = [];

  for (const seed of seeds) {
    const tenant = await prisma.tenant.create({
      data: {
        name: `Access ${seed.plan}`,
        slug: seed.slug,
        features: { clinicProfile: { clinicType: 'medical' } },
      },
    });
    const platformTenant = await prisma.platformTenant.create({
      data: {
        tenantId: tenant.id,
        displayName: `Access ${seed.plan}`,
        region: 'ME_SOUTH',
        plan: seed.plan,
        status: 'ACTIVE',
        provisionedBy: randomUUID(),
      },
    });
    await prisma.platformSubscription.create({
      data: {
        platformTenantId: platformTenant.id,
        plan: seed.plan,
        status: seed.subscriptionStatus,
        pricePerMonth: 99,
        startDate: new Date(Date.now() - 86_400_000),
        endDate: new Date(Date.now() + 365 * 86_400_000),
      },
    });
    fixtures.push({
      platformTenantId: platformTenant.id,
      tenantId: tenant.id,
      plan: seed.plan,
      subscriptionStatus: seed.subscriptionStatus,
    });
  }

  return fixtures;
}

function assertAccessSummaryShape(summary: AccessSummaryDto, tenantFeatures: unknown) {
  const serialized = JSON.stringify(summary);
  expect(serialized).not.toContain('"clinicProfile"');
  expect(JSON.stringify(tenantFeatures)).not.toEqual(expect.stringContaining(serialized));

  for (const group of [summary.modules, summary.features, summary.limits]) {
    for (const cap of group) {
      expect(cap.sourceType).toBe('current_license_projection');
      expect(['plan_version_default', 'addon', 'governed_override']).not.toContain(cap.sourceType);
    }
  }

  expect(summary.grants?.sourceType).toBe('current_license_projection');
  expect(summary.grants?.sourceType).not.toBe('addon');
  expect(summary.sourceClasses.legacyPlanAssignment.availability).toBe('available_legacy');
  expect(summary.uiPlan).not.toBe(summary.backendPlan);

  for (const limit of summary.limits) {
    if (limit.unlimited) {
      expect(limit.value).toBeNull();
    } else if (limit.unknown) {
      expect(limit.value).not.toBe(0);
    }
  }
}

describe('Platform tenants access summary postgres integration', () => {
  let prisma: ReturnType<typeof createPlatformDbSecurityClient>;
  let fixtures: AccessSummaryFixture[];

  beforeAll(async () => {
    if (!run) return;
    prisma = createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    if (!run || !prisma) return;
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    if (!run) return;
    await cleanupPlatformTenantsTables(prisma);
    await cleanupAccessSummarySlugs(prisma);
    fixtures = await seedAccessSummaryFixtures(prisma);
    expect(fixtures.length).toBeGreaterThanOrEqual(3);
  });

  (run ? it : it.skip)('reconciles licensing engine output through access summary DTO', async () => {
    const licensing = createLicensingEngine(prisma);
    const lite = fixtures.find((f) => f.plan === 'LITE')!;
    licensing.invalidateCache(lite.tenantId);

    const licenseBefore = await licensing.resolveLicense(lite.tenantId);
    const { service } = makeDetailService(prisma, licensing);

    const summary = (await service.getAccessSummary(CLAIMS, lite.platformTenantId)) as AccessSummaryDto;
    expect(summary.availability).toBe('available');

    const tenantRow = await prisma.tenant.findUnique({ where: { id: lite.tenantId } });
    assertAccessSummaryShape(summary, tenantRow?.features);

    const unlimitedLimit = summary.limits.find((l) => l.unlimited);
    if (unlimitedLimit) {
      expect(unlimitedLimit.value).toBeNull();
    }

    const liteLicense = await licensing.resolveLicense(lite.tenantId);
    expect(liteLicense.status).toBe(licenseBefore.status);
    expect(liteLicense.uiPlan).toBe(licenseBefore.uiPlan);
    expect(liteLicense.backendPlan).toBe(licenseBefore.backendPlan);
  });

  (run ? it : it.skip)('returns known module capability and 404 for unknown keys', async () => {
    const licensing = createLicensingEngine(prisma);
    const lite = fixtures.find((f) => f.plan === 'LITE')!;
    licensing.invalidateCache(lite.tenantId);
    const { service } = makeDetailService(prisma, licensing);

    const patients = await service.getAccessSummaryItem(CLAIMS, lite.platformTenantId, 'patients');
    expect(patients).toMatchObject({
      key: 'patients',
      kind: 'module',
      sourceType: 'current_license_projection',
    });
    expect((patients as { sourceLabel?: string }).sourceLabel).toBeTruthy();

    await expect(
      service.getAccessSummaryItem(CLAIMS, lite.platformTenantId, 'nonexistent_module_key'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  (run ? it : it.skip)('maps UNLIMITED (-1) limits to unlimited flag', async () => {
    const licensing = createLicensingEngine(prisma);
    const enterprise = fixtures.find((f) => f.plan === 'ENTERPRISE')!;
    licensing.invalidateCache(enterprise.tenantId);

    const license = await licensing.resolveLicense(enterprise.tenantId);
    const hasUnlimited = Object.values(license.effectiveLimits).some((v) => v === UNLIMITED);
    expect(hasUnlimited).toBe(true);

    const { service } = makeDetailService(prisma, licensing);
    const summary = (await service.getAccessSummary(CLAIMS, enterprise.platformTenantId)) as AccessSummaryDto;
    expect(summary.limits.some((l) => l.unlimited)).toBe(true);
  });
});
