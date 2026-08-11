/**
 * Flexible Step 25 — explicit RTE01–RTE08 runtime mapping suite.
 *
 * Each `it('RTExx: ...')` re-expresses the EXACT assertion for that ID (may duplicate
 * logic from X05, U25, C25-04, D05 for reviewability — do not just call another test).
 * Runtime denial/allow is proven through Step 18 EER (createSalesTrialsStack provides eer).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial RTE01–RTE08 runtime mapping (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;
  let trialPlanVersionId: string;
  let paidPlanVersionId: string;

  beforeAll(async () => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
    keys = await resolveCatalogKeys(prisma);
  });

  afterAll(async () => {
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesTrialsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesTrialTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
    trialPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        moduleKeys: keys.moduleKeys.slice(0, 3),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '7' }],
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 3),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '25' }],
      })
    ).planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-rte-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  async function seedActiveTrial(overrides: Record<string, unknown> = {}) {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      {
        organizationName: 'RTE Clinic',
        facilityTypeKey: keys.facilityTypeKey,
        trialPlanVersionId,
        selectedModuleKeys: keys.moduleKeys.slice(0, 3),
        selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
        ...overrides,
      } as never,
      randomUUID(),
    );
    const tenantId = (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: trial.platformTenantId! } })
    ).tenantId;
    return { actor, stack, trial, tenantId };
  }

  function futureStack(days = 30) {
    return createSalesTrialsStack(prisma, { clock: () => new Date(Date.now() + days * DAY_MS) });
  }

  it('RTE01: active Trial runtime matches Trial configuration — canUseModule true; getLimit CONFIGURED matching plan; source SNAPSHOT', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const selectedModule = keys.moduleKeys[0];
    const mod = await stack.eer.canUseModule(tenantId, selectedModule);
    expect(mod.allowed).toBe(true);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.state).toBe('CONFIGURED');
    expect(limit.state === 'CONFIGURED' && limit.value).toBe('7');
    expect(limit.source).toBe('SNAPSHOT');
  });

  it('RTE02: expiry denies — after expiry canUseModule false + platform_tenant_suspended', async () => {
    const { tenantId } = await seedActiveTrial({ durationDays: 1 });
    const stack = createSalesTrialsStack(prisma);
    const before = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(before.allowed).toBe(true);

    await futureStack().expiry.processDueTrials(10);
    const after = await stack.eer.canUseModule(tenantId, keys.moduleKeys[0]);
    expect(after.allowed).toBe(false);
    expect(after.code).toBe('platform_tenant_suspended');
  });

  it('RTE03: conversion switches to paid effective state — paid-only specialty present; source SNAPSHOT', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );
    const eer = createSalesTrialsStack(prisma).eer;
    const bundle = await eer.resolveEffectiveEntitlements(tenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.specialties).toContain(keys.specialtyKeys[2]);
    const paidOnly = await eer.canUseSpecialty(tenantId, keys.specialtyKeys[2]);
    expect(paidOnly.allowed).toBe(true);
  });

  it('RTE04: stale Trial snapshot not accepted after conversion — warmed EER instance shows paid state (SNAPSHOT), not old trial-only module set', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    const eer = stack.eer;
    const warm = await eer.resolveEffectiveEntitlements(tenantId);
    expect(warm.modules).toEqual(
      expect.arrayContaining(keys.moduleKeys.slice(0, 3)),
    );
    expect(warm.modules).toHaveLength(3);

    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      { targetPaidPlanVersionId: paidPlanVersionId, expectedRowVersion: trial.rowVersion },
      randomUUID(),
    );

    // Same EER instance (warmed process-local cache) must resolve paid state, not stale Trial modules.
    const after = await eer.resolveEffectiveEntitlements(tenantId);
    expect(after.source).toBe('SNAPSHOT');
    expect(after.modules).toEqual(expect.arrayContaining(keys.moduleKeys.slice(0, 2)));
    expect(after.modules).toHaveLength(2);
    expect(after.modules).not.toContain(keys.moduleKeys[2]);
    expect(after.specialties).toContain(keys.specialtyKeys[2]);
  });

  it('RTE05: PlatformTenant SUSPENDED denies module access (managed deny path; proves accepted deny without PENDING_PROVISIONING seed)', async () => {
    const { tenantId, trial } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    expect((await stack.eer.canUseModule(tenantId, keys.moduleKeys[0])).allowed).toBe(true);

    await prisma.platformTenant.update({
      where: { id: trial.platformTenantId! },
      data: { status: 'SUSPENDED', suspensionReason: 'rte05_managed_deny' },
    });
    // Force a fresh resolve after authoritative lifecycle mutation.
    const denied = await createSalesTrialsStack(prisma).eer.canUseModule(
      tenantId,
      keys.moduleKeys[0],
    );
    expect(denied.allowed).toBe(false);
    expect(denied.code).toBe('platform_tenant_suspended');
  });

  it('RTE06: no LEGACY fallback for managed Trial — limit.source === SNAPSHOT (not LEGACY)', async () => {
    const { tenantId } = await seedActiveTrial();
    const stack = createSalesTrialsStack(prisma);
    const limit = await stack.eer.getLimit(tenantId, keys.limitKeys[0]);
    expect(limit.source).toBe('SNAPSHOT');
    expect(limit.source).not.toBe('LEGACY');
  });

  it('RTE07: Add-on migration reflected — MIGRATE_TO_PAID_EQUIVALENT on ADD_ON; grant shows migration/paidEquivalentKey', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        dispositions: [
          {
            grantKey: 'addon.trial_boost',
            disposition: 'MIGRATE_TO_PAID_EQUIVALENT',
            paidEquivalentKey: 'addon.paid_boost',
          },
        ],
      },
      randomUUID(),
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'addon.trial_boost')).toMatchObject({
      disposition: 'MIGRATE_TO_PAID_EQUIVALENT',
      paidEquivalentKey: 'addon.paid_boost',
      expiredAt: null,
    });
  });

  it('RTE08: trial-only Override expiry reflected — EXPIRE_ON_CONVERSION; grant disposition expired; not paid authority on SoR', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [
        { grantKey: 'override.trial_discount', kind: 'OVERRIDE', trialOnly: true },
      ],
    });
    await stack.conversion.convert(
      actor.claims,
      stack.perms,
      trial.id,
      {
        targetPaidPlanVersionId: paidPlanVersionId,
        expectedRowVersion: trial.rowVersion,
        dispositions: [
          { grantKey: 'override.trial_discount', disposition: 'EXPIRE_ON_CONVERSION' },
        ],
      },
      randomUUID(),
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    const overrideGrant = grants.find((g) => g.grantKey === 'override.trial_discount');
    expect(overrideGrant?.disposition).toBe('EXPIRE_ON_CONVERSION');
    expect(overrideGrant?.expiredAt).toBeTruthy();
    // Runtime must not treat the expired trial-only override as paid authority on the SoR grant.
    expect(overrideGrant?.paidEquivalentKey ?? null).toBeNull();
    expect(row.status).toBe('CONVERTED');
  });
});
