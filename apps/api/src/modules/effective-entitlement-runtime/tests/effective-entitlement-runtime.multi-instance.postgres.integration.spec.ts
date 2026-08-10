/**
 * Step 17 multi-instance cache safety + expanded concurrency/failure injection (PostgreSQL).
 * Option B: two independent process-local caches; identity re-read from PG before reuse.
 */
import type { PrismaClient } from '@prisma/client';
import {
  activateCommercialFixture,
  assertSafePlatformTestDatabaseUrl,
  ALL_SUBSCRIPTION_PERMS,
  claims,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  clinicTenantIdFor,
  createPlatformDbSecurityClient,
  createRuntimeService,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensurePlatformSubscriptionFixtures,
  platformDbSecurityEnabled,
} from './effective-entitlement-runtime-db.harness';
import { EffectiveEntitlementCache } from '../application/effective-entitlement.cache';
import type { EffectiveEntitlementRuntimeService } from '../application/effective-entitlement-runtime.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 17 multi-instance cache + concurrency closure (postgres)', () => {
  let prisma: PrismaClient;
  let fixtures: Awaited<ReturnType<typeof ensurePlatformSubscriptionFixtures>>;
  let clinicTenantId: string;
  let instanceA: EffectiveEntitlementRuntimeService;
  let instanceB: EffectiveEntitlementRuntimeService;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    await prisma.$connect();
    await prisma.$executeRaw`SELECT set_config('app.platform_rls_bypass', 'true', false)`;
    fixtures = await ensurePlatformSubscriptionFixtures(prisma);
    clinicTenantId = await clinicTenantIdFor(prisma, fixtures.platformTenantId);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupPlatformSubscriptionCommercialTables(prisma);
    await cleanupFixtureRuntimeSubscriptions(prisma, fixtures.platformTenantId);
    instanceA = createRuntimeService(prisma);
    instanceB = createRuntimeService(prisma);
    instanceA.replaceCacheForTests(new EffectiveEntitlementCache());
    instanceB.replaceCacheForTests(new EffectiveEntitlementCache());
  });

  it('MI01: Instance B suspend → Instance A cannot return stale allow', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      effectiveEntitlements: instanceB,
    });
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'mi01',
    });
    const allowA = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(allowA.code).toBe('snapshot_resolved');
    expect(allowA.modules.length).toBeGreaterThan(0);

    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.configId },
    });
    await service.suspend(
      claims(),
      active.configId,
      { expectedRowVersion: row.rowVersion, reason: 'mi01' },
      'mi01-sus',
    );

    // Instance A does NOT receive invalidation — identity re-read must miss stale key.
    const after = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.code).toBe('runtime_suspended');
    expect(after.modules).toEqual([]);
    expect(after.provenance).toBe('AUTHORITATIVE_SUSPENDED');
  });

  it('MI02: Instance B cancel → Instance A cannot return legacy allow', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      effectiveEntitlements: instanceB,
    });
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'mi02',
    });
    await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.configId },
    });
    await service.cancel(
      claims(),
      active.configId,
      { expectedRowVersion: row.rowVersion, reason: 'mi02' },
      'mi02-cancel',
    );
    const after = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.source).toBe('SNAPSHOT');
    expect(after.code).toBe('runtime_terminal');
    expect(after.provenance).toBe('AUTHORITATIVE_TERMINAL');
    expect(after.modules).toEqual([]);
  });

  it('MI03: Instance B successor activation → Instance A cannot return predecessor allow', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      effectiveEntitlements: instanceB,
    });
    const first = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'mi03',
    });
    const before = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(before.snapshotId).toBe(first.snapshotId);

    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: first.configId },
    });
    const successor = await service.renew(
      claims(),
      first.configId,
      {
        expectedRowVersion: pred.rowVersion,
        reason: 'mi03 renew',
        renewalEffectiveAt: '2030-06-01T00:00:00.000Z',
      },
      'mi03-renew',
    );
    let rv = successor.rowVersion;
    if (!successor.planVersionId) {
      const assigned = await service.assignPlanVersion(
        claims(),
        successor.id,
        {
          expectedRowVersion: successor.rowVersion,
          planVersionId: fixtures.publishedPlanVersionId,
        },
        'mi03-plan',
      );
      rv = assigned.rowVersion;
    }
    await service.activate(
      claims(),
      successor.id,
      { expectedRowVersion: rv, reason: 'mi03 act' },
      'mi03-act',
    );

    const after = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.code).toBe('snapshot_resolved');
    expect(after.snapshotId).not.toBe(before.snapshotId);
    expect(after.provenance).toBe('AUTHORITATIVE_ACTIVE');
  });

  it('MI04: Instance A caches legacy; Instance B activates; Instance A leaves legacy', async () => {
    const legacy = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(legacy.source).toBe('LEGACY');
    expect(legacy.provenance).toBe('NEVER_MANAGED');

    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'mi04',
    });
    const after = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(after.source).toBe('SNAPSHOT');
    expect(after.code).toBe('snapshot_resolved');
    expect(after.provenance).toBe('AUTHORITATIVE_ACTIVE');
  });

  it('CX: concurrent resolve during successor Draft never returns legacy', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const first = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'cx-succ',
    });
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: first.configId },
    });
    await service.renew(
      claims(),
      first.configId,
      {
        expectedRowVersion: pred.rowVersion,
        reason: 'cx renew',
        renewalEffectiveAt: '2031-01-01T00:00:00.000Z',
      },
      'cx-renew',
    );
    const results = await Promise.all([
      instanceA.resolveEffectiveEntitlements(clinicTenantId),
      instanceB.resolveEffectiveEntitlements(clinicTenantId),
      instanceA.resolveEffectiveEntitlements(clinicTenantId),
    ]);
    for (const r of results) {
      expect(r.source).toBe('SNAPSHOT');
      expect(r.source).not.toBe('LEGACY');
      expect(r.code).toBe('snapshot_resolved');
      expect(r.snapshotId).toBe(first.snapshotId);
    }
  });

  const failurePointsActive = [
    'after_tenant_resolution',
    'after_provenance_classification',
    'after_current_configuration_resolution',
    'after_snapshot_load',
    'after_snapshot_validation',
    'after_fingerprint_validation',
    'after_composition',
    'before_cache_lookup',
    'after_cache_lookup',
    'before_cache_write',
  ] as const;

  it.each(failurePointsActive)('FI:%s — no commercial mutation; safe throw', async (point) => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: `fi-${point}`,
    });
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.count();
    const cfgBefore = await prisma.platformSubscriptionCommercialConfig.count();
    instanceA.setFailureHook(async (p) => {
      if (p === point) throw new Error(`injected_${point}`);
    });
    await expect(instanceA.resolveEffectiveEntitlements(clinicTenantId)).rejects.toThrow(
      new RegExp(`injected_${point}`),
    );
    expect(await prisma.platformSubscriptionCommercialSnapshot.count()).toBe(snapBefore);
    expect(await prisma.platformSubscriptionCommercialConfig.count()).toBe(cfgBefore);
    instanceA.setFailureHook(undefined);
    const ok = await instanceA.resolveEffectiveEntitlements(clinicTenantId);
    expect(ok.code).toBe('snapshot_resolved');
  });

  it('FI:after_predecessor_chain_resolution — fires on successor Draft handoff', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
    });
    const first = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 'fi-pred',
    });
    const pred = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: first.configId },
    });
    await service.renew(
      claims(),
      first.configId,
      {
        expectedRowVersion: pred.rowVersion,
        reason: 'fi pred renew',
        renewalEffectiveAt: '2032-01-01T00:00:00.000Z',
      },
      'fi-pred-renew',
    );
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.count();
    instanceA.setFailureHook(async (p) => {
      if (p === 'after_predecessor_chain_resolution') {
        throw new Error('injected_after_predecessor_chain_resolution');
      }
    });
    await expect(instanceA.resolveEffectiveEntitlements(clinicTenantId)).rejects.toThrow(
      /injected_after_predecessor_chain_resolution/,
    );
    expect(await prisma.platformSubscriptionCommercialSnapshot.count()).toBe(snapBefore);
    instanceA.setFailureHook(undefined);
  });
});
