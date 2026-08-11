import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesProductivityStack, MANAGER_PRODUCTIVITY_PERMS, REP_PRODUCTIVITY_PERMS } from './sales-productivity-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesProductivityTables,
  clearSalesProductivityFailureInjection,
  countCommissionAudits,
  countCommissionAuditsFor,
  createCommercialConfigFixture,
  createConversionFixture,
  createLeadFixture,
  createLeadNote,
  createOwnership,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  createStageHistory,
  createTenantFixture,
  createTrialFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  diffSoR,
  metricById,
  PERIOD_KEY,
  platformClaims,
  platformDbSecurityEnabled,
  protectedProductivitySoR,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  setSalesProductivityFailureInjection,
  type TrialCatalogKeys,
} from './sales-productivity-db.harness';
import {
  SALES_COMMISSION_AUDIT_ACTIONS,
  SALES_PRODUCTIVITY_PERMISSIONS,
  SALES_PRODUCTIVITY_FAILURE_INJECTION_POINTS,
  COMMISSION_FORMULA_VERSION,
} from '../platform-sales-productivity.constants';
import {
  SalesProductivityConflictError,
  SalesProductivityForbiddenError,
  SalesProductivityNotFoundError,
  SalesProductivityValidationError,
} from '../domain/sales-productivity.errors';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 26 plan/add-on attribution PA01–PA08 (PostgreSQL)', () => {

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
    await cleanupSalesProductivityTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesProductivityFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesProductivityTables(prisma);
    await deletePlanVersionFixtures(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
    trialPlanVersionId = (await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    })).planVersionId;
    paidPlanVersionId = (await createPlanVersionFixture(prisma, {
      paid: true,
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
    })).planVersionId;
  });

  afterEach(() => clearSalesProductivityFailureInjection());

  async function managerActor() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, { email: `mgr-${randomUUID()}@test.local`, roleKeys });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    const stack = createSalesProductivityStack(prisma);
    return { user, session, claims, rep, stack };
  }

  async function repActor(opts: { managerRepresentativeId?: string | null; status?: 'ACTIVE' | 'SUSPENDED' } = {}) {
    const roleKeys = [SALES_REP_ROLE];
    const user = await createPlatformUserFixture(prisma, { email: `rep-${randomUUID()}@test.local`, roleKeys });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, {
      status: opts.status ?? 'ACTIVE',
      managerRepresentativeId: opts.managerRepresentativeId ?? null,
    });
    const stack = createSalesProductivityStack(prisma, { permissions: REP_PRODUCTIVITY_PERMS });
    return { user, session, claims, rep, stack };
  }

  it('PA01: Plan Version attribution exact for conversion targetPaidPlanVersionId', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.planVersionAttribution).toEqual([{ planVersionId: paidPlanVersionId, count: 1 }]);
  });

  it('PA02: Plan rename does not rewrite historical planVersionId identity', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const before = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    await prisma.platformPlan.updateMany({ where: { versions: { some: { id: paidPlanVersionId } } }, data: { canonicalKey: `plan.renamed_${randomUUID().slice(0, 8)}` } });
    const after = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(after.planVersionAttribution).toEqual(before.planVersionAttribution);
  });

  it('PA03: retired Plan Version remains historically reportable by id', async () => {
    const { user, rep, stack } = await managerActor();
    const retired = await createPlanVersionFixture(prisma, { paid: true, lifecycle: 'RETIRED', withFingerprint: true, moduleKeys: keys.moduleKeys.slice(0, 1) });
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: retired.planVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.planVersionAttribution.some((p) => p.planVersionId === retired.planVersionId)).toBe(true);
  });

  it('PA04: Add-on attribution exact for migrate disposition', async () => {
    const { user, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key }],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.addOnAttribution).toEqual([{ addOnVersionId: key, count: 1, basis: 'conversion_disposition_migrate' }]);
  });

  it('PA05: expired Add-on historical event handled by frozen disposition policy', async () => {
    const { user, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'RETAIN_NOT_TRIAL_ONLY', grantKey: key }],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.addOnAttribution[0]?.basis).toBe('conversion_disposition_retain');
  });

  it('PA06: trial-only Add-on not counted as paid unless explicitly converted/migrated', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'DROP_TRIAL_ONLY', grantKey: randomUUID() }],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M15').value).toBe(0);
  });

  it('PA07: conversion-migrated Add-on counted once', async () => {
    const { user, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [
        { disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key },
        { disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key },
      ],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M15').value).toBe(2);
    expect(bundle.addOnAttribution.find((a) => a.addOnVersionId === key)?.count).toBe(2);
  });

  it('PA08: replay does not double-count Add-on attribution in snapshot metrics', async () => {
    const { user, claims, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key }],
    });
    const idem = randomUUID();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const replay = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(replay.replayed).toBe(true);
    expect(replay.id).toBe(first.id);
    expect(replay.addOnAttribution).toEqual(first.addOnAttribution);
  });
});
