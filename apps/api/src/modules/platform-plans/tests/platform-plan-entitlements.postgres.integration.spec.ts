/**
 * Step 14 — Plan Version entitlements & Limits PostgreSQL integration.
 */
import type { PrismaClient } from '@prisma/client';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import {
  cleanupPlatformPlansTables,
  createEntitlementsService,
  createPlansService,
  createPlansSeedService,
  createPlatformDbSecurityClient,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformDbSecurityEnabled,
} from './platform-plans-db.harness';
import { ensurePlatformTestDbReady } from '../../auth/tests/platform-db-security.harness';
import { FakePlanAuditLog } from './support/fake-plan-audit-log';
import { seededEntitlementKeysForPlan } from '../domain/plan-entitlement-seed.inventory';

const MANAGER_PERMS = [
  'plan.view',
  'plan.create',
  'plan.edit',
  'plan.lifecycle',
  'plan.alias.manage',
  'plan-version.view',
  'plan-version.create',
  'plan-version.review',
  'plan-version.publish',
  'plan-version.retire',
  'plan-entitlement.view',
  'plan-entitlement.manage',
  'plan-limit.view',
  'plan-limit.manage',
];

const CLAIMS = {
  sub: '00000000-0000-4000-8000-000000000014',
  sessionId: '11111111-1111-4111-8111-111111111114',
} as JwtClaimsVO;

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Platform Plan Entitlements PostgreSQL', () => {
  let prisma: PrismaClient;
  let audit: FakePlanAuditLog;

  beforeAll(async () => {
    prisma = createPlatformDbSecurityClient(DEFAULT_PLATFORM_DB_SECURITY_URL);
    await ensurePlatformTestDbReady(prisma, 45);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformPlansTables(prisma);
    audit = new FakePlanAuditLog();
    let dash = await prisma.healthcareCatalogItem.findUnique({
      where: { canonicalKey: 'module.dashboard' },
    });
    if (!dash) {
      const { HealthcareCatalogSeedService } = await import(
        '../../platform-healthcare-catalog/application/catalog-seed.service'
      );
      const catalogSeed = new HealthcareCatalogSeedService({
        withPlatformBypass: async <T>(fn: (client: typeof prisma) => Promise<T>) =>
          prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', true)`;
            await tx.$executeRaw`SELECT set_config('app.current_tenant_id', '', true)`;
            return fn(tx as unknown as typeof prisma);
          }),
      } as never);
      await catalogSeed.seedAll();
      dash = await prisma.healthcareCatalogItem.findUnique({
        where: { canonicalKey: 'module.dashboard' },
      });
    }
    if (!dash) {
      throw new Error(
        'Healthcare Catalog seed required before Step 14 entitlement tests (module.dashboard missing).',
      );
    }
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
  });

  it('seeds Draft entitlements and Limits for three Plans without publishing', async () => {
    const versions = await prisma.platformPlanVersion.findMany({
      where: { lifecycle: 'DRAFT' },
      include: { plan: true, entitlements: true, limits: true },
    });
    expect(versions).toHaveLength(3);
    for (const v of versions) {
      expect(v.publishedAt).toBeNull();
      expect(v.entitlements.length).toBeGreaterThan(0);
      expect(v.limits.length).toBe(12);
      expect(v.entitlements.length).toBe(seededEntitlementKeysForPlan(v.plan.canonicalKey as never).length);
    }
    // Administrator-edit preservation on reseed
    const first = versions[0]!;
    await prisma.platformPlanVersionEntitlement.deleteMany({
      where: { planVersionId: first.id },
    });
    await prisma.platformPlanVersionEntitlement.create({
      data: {
        planVersionId: first.id,
        catalogItemId: (
          await prisma.healthcareCatalogItem.findUniqueOrThrow({
            where: { canonicalKey: 'module.dashboard' },
          })
        ).id,
      },
    });
    await createPlansSeedService(prisma).seedAll({ includeCommercialDefinitions: true });
    const after = await prisma.platformPlanVersionEntitlement.count({
      where: { planVersionId: first.id },
    });
    expect(after).toBe(1);
  });

  it('atomic entitlement replace and Limit replace with OCC and audit', async () => {
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    const version = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const ents = createEntitlementsService({
      prisma,
      permissions: MANAGER_PERMS,
      audit,
    });
    const snap = await ents.putEntitlements(
      CLAIMS,
      plan.id,
      version.id,
      {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: ['module.dashboard', 'module.patients'],
      },
      'idem-ent-1',
    );
    expect(snap.entitlementCount).toBe(2);
    const replay = await ents.putEntitlements(
      CLAIMS,
      plan.id,
      version.id,
      {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: ['module.dashboard', 'module.patients'],
      },
      'idem-ent-1',
    );
    expect(replay.entitlementCount).toBe(2);
    expect(audit.records.filter((r) => r.action.includes('entitlements_replaced'))).toHaveLength(1);

    const refreshed = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
    await expect(
      ents.putEntitlements(CLAIMS, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: ['module.dashboard'],
      }),
    ).rejects.toThrow(/Stale/);

    await ents.putLimits(CLAIMS, plan.id, version.id, {
      expectedRowVersion: refreshed.rowVersion,
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '25' }],
    });
    const limits = await ents.getLimits(CLAIMS, plan.id, version.id);
    const users = limits.items.find((i) => i.canonicalKey === 'limit.max_users');
    expect(users?.configuredState).toBe('CONFIGURED');
    expect(users?.valueText).toBe('25');
    expect(limits.items.find((i) => i.canonicalKey === 'limit.max_doctors')?.configuredState).toBe(
      'UNCONFIGURED',
    );
  });

  it('rejects Limit as entitlement and rejects Published mutation', async () => {
    const plans = createPlansService({ prisma, permissions: MANAGER_PERMS, audit, stepUpFresh: true });
    const ents = createEntitlementsService({ prisma, permissions: MANAGER_PERMS, audit });
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.lite' } });
    let version = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });

    await expect(
      ents.putEntitlements(CLAIMS, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: ['limit.max_users'],
      }),
    ).rejects.toThrow(/Limit|kind|entitlement/i);

    // Publish with seeded set (empty-set warning only — seeded non-empty should pass)
    version = await prisma.platformPlanVersion.findUniqueOrThrow({ where: { id: version.id } });
    const published = await plans.publishVersion(CLAIMS, plan.id, version.id, {
      expectedRowVersion: version.rowVersion,
      reason: 'Step 14 publish with entitlements',
    });
    expect(published.lifecycle).toBe('PUBLISHED');
    expect(published.publicationFingerprint).toMatch(/^[a-f0-9]{64}$/);

    await expect(
      ents.putEntitlements(CLAIMS, plan.id, published.id, {
        expectedRowVersion: published.rowVersion,
        entitlementKeys: ['module.dashboard'],
      }),
    ).rejects.toThrow(/immutable/i);

    const cloned = await plans.cloneVersion(CLAIMS, plan.id, published.id);
    expect(cloned.lifecycle).toBe('DRAFT');
    const clonedEnts = await prisma.platformPlanVersionEntitlement.count({
      where: { planVersionId: cloned.id },
    });
    const sourceEnts = await prisma.platformPlanVersionEntitlement.count({
      where: { planVersionId: published.id },
    });
    expect(clonedEnts).toBe(sourceEnts);
    expect(clonedEnts).toBeGreaterThan(0);
  });

  it('readiness reports Step 15 domains unavailable and runtimeEffective false', async () => {
    const plans = createPlansService({ prisma, permissions: MANAGER_PERMS, audit });
    const plan = await prisma.platformPlan.findUniqueOrThrow({ where: { canonicalKey: 'plan.pro' } });
    const version = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const readiness = await plans.getReadiness(CLAIMS, plan.id, version.id);
    expect(readiness.subscriptionEligibility).toBe(false);
    expect(readiness.runtimeEffective).toBe(false);
    expect(readiness.addonReadiness.status).toBe('available');
    expect(readiness.overrideReadiness.status).toBe('available');
    expect(readiness.addonReadiness.reason).toBe('step_15_commercial_definition');
    expect(readiness.overrideReadiness.reason).toBe('step_15_commercial_definition');
    expect(readiness.publicationReady).toBe(true);
  });

  it('entitlement manage cannot mutate without permission; Limit manage isolated', async () => {
    const plan = await prisma.platformPlan.findUniqueOrThrow({
      where: { canonicalKey: 'plan.enterprise' },
    });
    const version = await prisma.platformPlanVersion.findFirstOrThrow({
      where: { planId: plan.id, lifecycle: 'DRAFT' },
    });
    const viewOnly = createEntitlementsService({
      prisma,
      permissions: ['plan-entitlement.view', 'plan-limit.view'],
    });
    await expect(
      viewOnly.putEntitlements(CLAIMS, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        entitlementKeys: [],
      }),
    ).rejects.toThrow(/Missing plan-entitlement.manage/);
    await expect(
      viewOnly.putLimits(CLAIMS, plan.id, version.id, {
        expectedRowVersion: version.rowVersion,
        limits: [],
      }),
    ).rejects.toThrow(/Missing plan-limit.manage/);
  });
});
