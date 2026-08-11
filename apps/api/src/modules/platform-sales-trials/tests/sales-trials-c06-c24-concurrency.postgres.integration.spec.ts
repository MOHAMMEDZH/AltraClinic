/**
 * Flexible Step 25 - narrow concurrency closure C06-C24.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md sections 8-11
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesTrialsStack } from './sales-trials-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesTrialTables,
  clearSalesTrialsFailureInjection,
  countTrialAuditsFor,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  setSalesTrialsFailureInjection,
  type TrialCatalogKeys,
} from './sales-trials-db.harness';
import {
  SALES_TRIAL_AUDIT_ACTIONS,
  TRIAL_CONVERSION_OUTBOX_EVENT_TYPE,
} from '../platform-sales-trials.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const DAY_MS = 86_400_000;

describeDb('Step 25 Trial concurrency C06-C24 (PostgreSQL)', () => {
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
        canonicalKeySuffix: `trial_${randomUUID().slice(0, 6)}`,
        moduleKeys: keys.moduleKeys.slice(0, 3),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '5' }],
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        canonicalKeySuffix: `paid_${randomUUID().slice(0, 6)}`,
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 3),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '50' }],
      })
    ).planVersionId;
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `trial-c06-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return { user, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  function createInput(overrides: Record<string, unknown> = {}) {
    return {
      organizationName: 'Concurrency Clinic',
      facilityTypeKey: keys.facilityTypeKey,
      trialPlanVersionId,
      selectedModuleKeys: keys.moduleKeys.slice(0, 3),
      selectedSpecialtyKeys: keys.specialtyKeys.slice(0, 2),
      ...overrides,
    } as never;
  }

  async function seedActiveTrial(overrides: Record<string, unknown> = {}) {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput(overrides),
      randomUUID(),
    );
    const tenantId = (
      await prisma.platformTenant.findUniqueOrThrow({ where: { id: trial.platformTenantId! } })
    ).tenantId;
    return { actor, stack, trial, tenantId };
  }

  function convertBody(
    trial: { rowVersion: number },
    extras: Record<string, unknown> = {},
    targetId = paidPlanVersionId,
  ) {
    return {
      targetPaidPlanVersionId: targetId,
      expectedRowVersion: trial.rowVersion,
      ...extras,
    };
  }

  // --- C06-C24 ------------------------------------------------------------------

  it('C06: Override update race - N/A: no Trial Override update API (Overrides are Step 16; Trial-only Override disposition is C22)', async () => {
    // Documented N/A: Step 25 Trial surface has no Override-update endpoint to race.
    // Trial-only Override grants are dispositioned at conversion (see C22).
    expect(true).toBe(true);
  });

  it('C07: extension vs extension - concurrent extend same rowVersion -> exactly one success, history=1', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const attempt = (reason: string) =>
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 3, reason, expectedRowVersion: trial.rowVersion },
        randomUUID(),
      );
    const results = await Promise.allSettled([attempt('racer a'), attempt('racer b')]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
    expect(
      await prisma.platformSalesTrialExtensionHistory.count({ where: { trialId: trial.id } }),
    ).toBe(1);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(row.extensionCount).toBe(1);
  });

  it('C08: extension vs expiry - concurrent extend + processDueTrials -> coherent ACTIVE+extended or EXPIRED', async () => {
    const { actor, stack, trial } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * DAY_MS);
    const expiryStack = createSalesTrialsStack(prisma, { clock: () => future });
    await Promise.allSettled([
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 7, reason: 'race extend', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
      expiryStack.expiry.processDueTrials(10),
    ]);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const history = await prisma.platformSalesTrialExtensionHistory.findMany({
      where: { trialId: trial.id },
    });
    expect(['ACTIVE', 'EXPIRED']).toContain(row.status);
    if (row.status === 'ACTIVE') {
      // Extend claimed before expiry; window widened past the expiry clock.
      expect(row.extensionCount).toBe(1);
      expect(history).toHaveLength(1);
      expect(row.expiredAt).toBeNull();
      expect(
        await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
      ).toBe(0);
    } else {
      // Expire won OCC: never leave orphan extension history on an expired Trial.
      expect(row.expiredAt).toBeTruthy();
      expect(history).toHaveLength(0);
      expect(row.extensionCount).toBe(0);
      expect(
        await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
      ).toBe(1);
    }
  });

  it('C09: conversion vs expiry - concurrent convert + expire -> exactly one coherent terminal', async () => {
    const { actor, stack, trial } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * DAY_MS);
    const expiryStack = createSalesTrialsStack(prisma, { clock: () => future });
    await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
      expiryStack.expiry.processDueTrials(10),
    ]);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const conversions = await prisma.platformSalesTrialConversion.count({
      where: { trialId: trial.id },
    });
    expect(['CONVERTED', 'EXPIRED']).toContain(row.status);
    if (row.status === 'CONVERTED') {
      expect(conversions).toBe(1);
      expect(
        await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
      ).toBe(0);
    } else {
      expect(conversions).toBe(0);
      expect(
        await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
      ).toBe(1);
      expect(
        await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.CONVERTED, trial.id),
      ).toBe(0);
    }
  });

  it('C10: conversion vs extension - concurrent convert + extend -> coherent CONVERTED or ACTIVE+extended', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const preExpiresAt = trial.expiresAt;
    await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
      stack.trials.extend(
        actor.claims,
        stack.perms,
        trial.id,
        { extensionDays: 5, reason: 'race extend', expectedRowVersion: trial.rowVersion },
        randomUUID(),
      ),
    ]);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const conversions = await prisma.platformSalesTrialConversion.count({
      where: { trialId: trial.id },
    });
    const history = await prisma.platformSalesTrialExtensionHistory.count({
      where: { trialId: trial.id },
    });
    expect(['CONVERTED', 'ACTIVE']).toContain(row.status);
    if (row.status === 'CONVERTED') {
      expect(conversions).toBe(1);
      expect(history).toBe(0);
      expect(row.extensionCount).toBe(0);
      expect(row.expiresAt?.toISOString()).toBe(preExpiresAt);
    } else {
      expect(row.status).toBe('ACTIVE');
      expect(conversions).toBe(0);
      expect(history).toBe(1);
      expect(row.extensionCount).toBe(1);
      expect(row.expiresAt?.toISOString()).not.toBe(preExpiresAt);
    }
  });

  it('C11: conversion vs Trial config update - concurrent convert + update organizationName -> one coherent outcome', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const results = await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
      stack.trials.update(actor.claims, stack.perms, trial.id, {
        organizationName: 'Race Renamed Clinic',
        expectedRowVersion: trial.rowVersion,
        reason: 'config race',
      }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    const conversions = await prisma.platformSalesTrialConversion.count({
      where: { trialId: trial.id },
    });
    if (row.status === 'CONVERTED') {
      expect(conversions).toBe(1);
    } else {
      expect(row.status).toBe('ACTIVE');
      expect(conversions).toBe(0);
      expect(row.organizationName).toBe('Race Renamed Clinic');
    }
  });

  it('C12: conversion vs owner reassignment - attributionSnapshot frozen; owner updates only if convert lost', async () => {
    const actor = await manager();
    const repA = await createPlatformUserFixture(prisma, {
      email: `c12a-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const repB = await createPlatformUserFixture(prisma, {
      email: `c12b-${randomUUID()}@test.local`,
      roleKeys: [SALES_REP_ROLE],
    });
    const profileA = await createRepProfile(prisma, repA.id);
    const profileB = await createRepProfile(prisma, repB.id);
    const stack = createSalesTrialsStack(prisma);
    const trial = await stack.trials.create(
      actor.claims,
      stack.perms,
      createInput({ ownerRepresentativeId: profileA.id }),
      randomUUID(),
    );
    const preSnapshot = trial.attributionSnapshot;
    expect(preSnapshot?.ownerRepresentativeId).toBe(profileA.id);

    await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
      stack.trials.update(actor.claims, stack.perms, trial.id, {
        ownerRepresentativeId: profileB.id,
        expectedRowVersion: trial.rowVersion,
        reason: 'reassign race',
      }),
    ]);

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.attributionSnapshotJson).toEqual(preSnapshot);
    const conversions = await prisma.platformSalesTrialConversion.count({
      where: { trialId: trial.id },
    });
    if (row.status === 'CONVERTED') {
      expect(conversions).toBe(1);
      // Convert won: owner remains the create-time owner (convert does not rewrite owner).
      expect(row.ownerRepresentativeId).toBe(profileA.id);
    } else {
      expect(row.status).toBe('ACTIVE');
      expect(conversions).toBe(0);
      expect(row.ownerRepresentativeId).toBe(profileB.id);
    }
  });

  it('C13: conversion same target concurrent - two converts same paid PV different keys -> conversion count=1', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const body = convertBody(trial);
    const results = await Promise.allSettled([
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
  });

  it('C14: conversion different target concurrent - two paid PVs -> exactly one conversion; commercial matches winner', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const paidB = (
      await createPlanVersionFixture(prisma, {
        canonicalKeySuffix: `paidb_${randomUUID().slice(0, 6)}`,
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        limits: [{ canonicalKey: keys.limitKeys[0], valueText: '75' }],
      })
    ).planVersionId;
    const results = await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial, {}, paidPlanVersionId),
        randomUUID(),
      ),
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial, {}, paidB),
        randomUUID(),
      ),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled').length).toBeGreaterThanOrEqual(1);
    const conversions = await prisma.platformSalesTrialConversion.findMany({
      where: { trialId: trial.id },
    });
    expect(conversions).toHaveLength(1);
    expect([paidPlanVersionId, paidB]).toContain(conversions[0].targetPaidPlanVersionId);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    const current = await prisma.platformSubscriptionCommercialConfig.findFirstOrThrow({
      where: { platformTenantId: trial.platformTenantId!, isCurrent: true },
    });
    expect(current.planVersionId).toBe(conversions[0].targetPaidPlanVersionId);
  });

  it('C15: expiry job multi-instance - two stacks processDueTrials -> expired sum=1, EXPIRED audit=1', async () => {
    const { trial } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * DAY_MS);
    const a = createSalesTrialsStack(prisma, { clock: () => future });
    const b = createSalesTrialsStack(prisma, { clock: () => future });
    const [ra, rb] = await Promise.all([
      a.expiry.processDueTrials(10),
      b.expiry.processDueTrials(10),
    ]);
    expect(ra.expired + rb.expired).toBe(1);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
    ).toBe(1);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('EXPIRED');
  });

  it('C16: provisioning response-loss replay - inject after_commit_before_response; replay same key -> one ACTIVE trial', async () => {
    const actor = await manager();
    const stack = createSalesTrialsStack(prisma);
    const key = randomUUID();
    const body = createInput({ organizationName: 'C16 Replay Clinic' });
    setSalesTrialsFailureInjection('after_commit_before_response');
    await expect(stack.trials.create(actor.claims, stack.perms, body, key)).rejects.toMatchObject({
      code: 'injected_failure',
    });
    clearSalesTrialsFailureInjection();
    const replayStack = createSalesTrialsStack(prisma);
    const replayed = await replayStack.trials.create(actor.claims, replayStack.perms, body, key);
    expect(replayed.status).toBe('ACTIVE');
    expect(
      await prisma.platformSalesTrial.count({ where: { organizationName: 'C16 Replay Clinic' } }),
    ).toBe(1);
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: 'trial-' } } });
    expect(tenants).toHaveLength(1);
  });

  it('C17: lifecycle handoff replay - expire once; processDueTrials again -> no second lifecycle; SUSPENDED once', async () => {
    const { trial, tenantId } = await seedActiveTrial({ durationDays: 1 });
    const future = new Date(Date.now() + 3 * DAY_MS);
    const stack = createSalesTrialsStack(prisma, { clock: () => future });
    const first = await stack.expiry.processDueTrials(10);
    expect(first.expired).toBe(1);
    const second = await stack.expiry.processDueTrials(10);
    expect(second.expired).toBe(0);
    expect(second.scanned).toBe(0);
    expect(
      await countTrialAuditsFor(prisma, SALES_TRIAL_AUDIT_ACTIONS.EXPIRED, trial.id),
    ).toBe(1);
    const platformTenant = await prisma.platformTenant.findFirstOrThrow({
      where: { tenantId },
    });
    expect(platformTenant.status).toBe('SUSPENDED');
    expect(platformTenant.suspensionReason).toContain('sales_trial_expired');
    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    expect(tenant.lifecycleStatus).toBe('SUSPENDED');
    expect(tenant.status).toBe('SUSPENDED');
  });

  it('C18: conversion event duplicate race - concurrent convert -> outbox events for trial = 1', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const body = convertBody(trial);
    await Promise.allSettled([
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
    ]);
    expect(
      await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
    ).toBe(1);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
  });

  it('C19: stale rowVersion - convert with rowVersion-1 -> row_version_conflict; trial stays ACTIVE', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    await expect(
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        {
          targetPaidPlanVersionId: paidPlanVersionId,
          expectedRowVersion: trial.rowVersion - 1,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'row_version_conflict' });
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('ACTIVE');
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      0,
    );
  });

  it('C20: attribution preservation under race - concurrent convert + update org name; attributionSnapshot unchanged', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const frozen = trial.attributionSnapshot;
    await Promise.allSettled([
      stack.conversion.convert(
        actor.claims,
        stack.perms,
        trial.id,
        convertBody(trial),
        randomUUID(),
      ),
      stack.trials.update(actor.claims, stack.perms, trial.id, {
        organizationName: 'Attribution Race Clinic',
        expectedRowVersion: trial.rowVersion,
        reason: 'attribution race',
      }),
    ]);
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.attributionSnapshotJson).toEqual(frozen);
    if (row.status === 'CONVERTED') {
      expect(
        await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } }),
      ).toBe(1);
    }
  });

  it('C21: trial-only Add-on disposition race - concurrent converts with dispositions -> one conversion; grant applied fully', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [{ grantKey: 'addon.trial_boost', kind: 'ADD_ON', trialOnly: true }],
    });
    const dispositions = [
      { grantKey: 'addon.trial_boost', disposition: 'EXPIRE_ON_CONVERSION' as const },
    ];
    const body = convertBody(trial, { dispositions });
    await Promise.allSettled([
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
    ]);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    const boost = grants.find((g) => g.grantKey === 'addon.trial_boost');
    expect(boost).toMatchObject({
      disposition: 'EXPIRE_ON_CONVERSION',
    });
    expect(boost?.expiredAt).toBeTruthy();
    const conversion = await prisma.platformSalesTrialConversion.findFirstOrThrow({
      where: { trialId: trial.id },
    });
    const persisted = conversion.dispositionsJson as Array<Record<string, unknown>>;
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({
      grantKey: 'addon.trial_boost',
      disposition: 'EXPIRE_ON_CONVERSION',
    });
  });

  it('C22: trial-only Override disposition race - concurrent converts with dispositions -> one conversion; override applied', async () => {
    const { actor, stack, trial } = await seedActiveTrial({
      trialOnlyGrants: [
        { grantKey: 'override.trial_discount', kind: 'OVERRIDE', trialOnly: true },
      ],
    });
    const dispositions = [
      {
        grantKey: 'override.trial_discount',
        disposition: 'MIGRATE_TO_PAID_EQUIVALENT' as const,
        paidEquivalentKey: 'override.paid_discount',
      },
    ];
    const body = convertBody(trial, { dispositions });
    await Promise.allSettled([
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
    ]);
    expect(await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } })).toBe(
      1,
    );
    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    const grants = row.trialOnlyGrantsJson as Array<Record<string, unknown>>;
    expect(grants.find((g) => g.grantKey === 'override.trial_discount')).toMatchObject({
      disposition: 'MIGRATE_TO_PAID_EQUIVALENT',
      paidEquivalentKey: 'override.paid_discount',
      expiredAt: null,
    });
  });

  it('C23: EER snapshot refresh race - warm EER; concurrent convert; paid SNAPSHOT not stale trial allow', async () => {
    const { actor, stack, trial, tenantId } = await seedActiveTrial();
    const trialOnlyModule = keys.moduleKeys[2];
    const warm = await stack.eer.resolveEffectiveEntitlements(tenantId);
    expect(warm.source).toBe('SNAPSHOT');
    expect(warm.modules).toContain(trialOnlyModule);
    const beforePaidAllow = await stack.eer.canUseModule(tenantId, trialOnlyModule);
    expect(beforePaidAllow.allowed).toBe(true);

    const body = convertBody(trial);
    await Promise.allSettled([
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
      stack.conversion.convert(actor.claims, stack.perms, trial.id, body, randomUUID()),
    ]);

    const row = await prisma.platformSalesTrial.findUniqueOrThrow({ where: { id: trial.id } });
    expect(row.status).toBe('CONVERTED');
    const bundle = await stack.eer.resolveEffectiveEntitlements(tenantId);
    expect(bundle.source).toBe('SNAPSHOT');
    expect(bundle.specialties).toContain(keys.specialtyKeys[2]);
    // Paid PV excludes trial-only module; warmed trial allow must not survive.
    expect(bundle.modules).not.toContain(trialOnlyModule);
    const after = await stack.eer.canUseModule(tenantId, trialOnlyModule);
    expect(after.allowed).toBe(false);
  });

  it('C24: exact audit/history cardinality - convert once; counts exact; replay unchanged', async () => {
    const { actor, stack, trial } = await seedActiveTrial();
    const extensionBefore = await prisma.platformSalesTrialExtensionHistory.count({
      where: { trialId: trial.id },
    });
    const key = randomUUID();
    const body = convertBody(trial);
    await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    const measure = async () => ({
      convertedAudit: await countTrialAuditsFor(
        prisma,
        SALES_TRIAL_AUDIT_ACTIONS.CONVERTED,
        trial.id,
      ),
      conversions: await prisma.platformSalesTrialConversion.count({ where: { trialId: trial.id } }),
      outbox: await prisma.outboxEvent.count({
        where: { aggregateId: trial.id, eventType: TRIAL_CONVERSION_OUTBOX_EVENT_TYPE },
      }),
      extensions: await prisma.platformSalesTrialExtensionHistory.count({
        where: { trialId: trial.id },
      }),
    });
    const afterFirst = await measure();
    expect(afterFirst).toEqual({
      convertedAudit: 1,
      conversions: 1,
      outbox: 1,
      extensions: extensionBefore,
    });
    const replay = await stack.conversion.convert(actor.claims, stack.perms, trial.id, body, key);
    expect(replay.replayed).toBe(true);
    expect(await measure()).toEqual(afterFirst);
  });
});
