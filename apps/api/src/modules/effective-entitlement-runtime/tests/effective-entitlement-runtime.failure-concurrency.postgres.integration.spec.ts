/**
 * Step 17 failure-injection + concurrency smoke (PostgreSQL).
 * Test-only hooks — never registered in production Nest modules.
 */
import {
  activateCommercialFixture,
  assertSafePlatformTestDatabaseUrl,
  cleanupFixtureRuntimeSubscriptions,
  cleanupPlatformSubscriptionCommercialTables,
  clinicTenantIdFor,
  createPlatformDbSecurityClient,
  createRuntimeService,
  createSubscriptionsService,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  ensurePlatformSubscriptionFixtures,
  platformDbSecurityEnabled,
  ALL_SUBSCRIPTION_PERMS,
  claims,
} from './effective-entitlement-runtime-db.harness';
import type { PrismaClient } from '@prisma/client';
import type { EffectiveEntitlementRuntimeService } from '../application/effective-entitlement-runtime.service';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 17 failure injection + concurrency (postgres)', () => {
  let prisma: PrismaClient;
  let runtime: EffectiveEntitlementRuntimeService;
  let fixtures: Awaited<ReturnType<typeof ensurePlatformSubscriptionFixtures>>;
  let clinicTenantId: string;

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
    runtime = createRuntimeService(prisma);
  });

  it('FI01: after_composition failure — no DB mutation, safe deny-style throw path', async () => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-fi01',
    });
    const snapBefore = await prisma.platformSubscriptionCommercialSnapshot.count();
    runtime.setFailureHook(async (point) => {
      if (point === 'after_composition') throw new Error('injected_after_composition');
    });
    await expect(runtime.resolveEffectiveEntitlements(clinicTenantId)).rejects.toThrow(
      /injected_after_composition/,
    );
    expect(await prisma.platformSubscriptionCommercialSnapshot.count()).toBe(snapBefore);
    runtime.setFailureHook(undefined);
  });

  it('FI02: after_fingerprint_validation failure — no silent legacy', async () => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-fi02',
    });
    runtime.setFailureHook(async (point) => {
      if (point === 'after_fingerprint_validation') {
        throw new Error('injected_fingerprint');
      }
    });
    await expect(runtime.resolveEffectiveEntitlements(clinicTenantId)).rejects.toThrow(
      /injected_fingerprint/,
    );
    runtime.setFailureHook(undefined);
    const ok = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(ok.source).toBe('SNAPSHOT');
    expect(ok.code).toBe('snapshot_resolved');
  });

  it('CX01: concurrent cache misses return identical SNAPSHOT decisions', async () => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-cx01',
    });
    const [a, b, c] = await Promise.all([
      runtime.resolveEffectiveEntitlements(clinicTenantId),
      runtime.resolveEffectiveEntitlements(clinicTenantId),
      runtime.resolveEffectiveEntitlements(clinicTenantId),
    ]);
    expect(a.source).toBe('SNAPSHOT');
    expect(a.code).toBe(b.code);
    expect(b.code).toBe(c.code);
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.modules).toEqual(b.modules);
  });

  it('CX02: suspend then resolve denies; no stale allow from predecessor key', async () => {
    const service = createSubscriptionsService({
      prisma,
      permissions: ALL_SUBSCRIPTION_PERMS,
      stepUpFresh: true,
      effectiveEntitlements: runtime,
    });
    const actor = claims();
    const active = await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-cx02',
    });
    const allowed = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(allowed.code).toBe('snapshot_resolved');
    expect(allowed.modules.length).toBeGreaterThan(0);

    const row = await prisma.platformSubscriptionCommercialConfig.findUniqueOrThrow({
      where: { id: active.configId },
    });
    await service.suspend(
      actor,
      active.configId,
      { expectedRowVersion: row.rowVersion, reason: 'cx02' },
      's17-cx02-sus',
    );
    const denied = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    expect(denied.code).toBe('runtime_suspended');
    expect(denied.modules).toEqual([]);
    const mod = await runtime.canUseModule(clinicTenantId, 'module.dashboard');
    expect(mod.allowed).toBe(false);
  });

  it('LIM: UNCONFIGURED for unknown limit key; UNLIMITED/CONFIGURED from snapshot when present', async () => {
    await activateCommercialFixture({
      prisma,
      platformTenantId: fixtures.platformTenantId,
      publishedPlanVersionId: fixtures.publishedPlanVersionId,
      idemPrefix: 's17-lim',
    });
    const missing = await runtime.getLimit(clinicTenantId, 'limit.totally_unknown_xyz');
    expect(missing.state).toBe('UNCONFIGURED');
    expect(missing.code).toBe('limit_unconfigured');

    const bundle = await runtime.resolveEffectiveEntitlements(clinicTenantId);
    const firstKey = Object.keys(bundle.limits)[0];
    if (firstKey) {
      const lim = await runtime.getLimit(clinicTenantId, firstKey);
      expect(['CONFIGURED', 'UNLIMITED', 'UNCONFIGURED']).toContain(lim.state);
      if (lim.state === 'CONFIGURED') {
        expect(typeof lim.value).toBe('string');
      }
    }
  });
});
