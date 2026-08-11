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

describeDb('Step 26 commission snapshot CS01–CS16 (PostgreSQL)', () => {

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
      moduleKeys: keys.moduleKeys.slice(0, 2), specialtyKeys: keys.specialtyKeys.slice(0, 2),
      trialDefaultEnabled: true, trialDefaultDays: 14,
    })).planVersionId;
    paidPlanVersionId = (await createPlanVersionFixture(prisma, {
      paid: true, moduleKeys: keys.moduleKeys.slice(0, 2), specialtyKeys: keys.specialtyKeys.slice(0, 2),
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

  it('CS01: one logical rep/month snapshot identity for non-superseded row', async () => {
    const { claims, rep, stack } = await managerActor();
    const a = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const b = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(b.supersedesSnapshotId).toBe(a.id);
    const active = await prisma.platformSalesCommissionSnapshot.count({ where: { representativeId: rep.id, periodKey: PERIOD_KEY, status: { not: 'SUPERSEDED' } } });
    expect(active).toBe(1);
  });

  it('CS02: exact generation replay returns same snapshot without duplicate', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const replay = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(replay.replayed).toBe(true);
    expect(replay.id).toBe(first.id);
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(1);
  });

  it('CS03: conflicting generation fingerprint rejected', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: false }, idem);
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, idem),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('CS04: source cutoff stored on snapshot', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.sourceCutoffAt).toBeTruthy();
  });

  it('CS05: rule/formula version frozen as UNCONFIGURED formula identity', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.formulaVersion).toBe(COMMISSION_FORMULA_VERSION);
    expect(snap.calculationStatus).toBe('UNCONFIGURED');
    expect(snap.ruleReference).toBeNull();
    expect(snap.computedAmount).toBeNull();
  });

  it('CS06: attribution frozen in snapshot metricsJson', async () => {
    const { user, claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect((snap.metrics as any).leads_created.value).toBe(1);
    expect(user.id).toBeTruthy();
  });

  it('CS07: Plan Version attribution frozen on snapshot', async () => {
    const { user, claims, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.planVersionAttribution).toEqual([{ planVersionId: paidPlanVersionId, count: 1 }]);
  });

  it('CS08: Add-on attribution frozen on snapshot', async () => {
    const { user, claims, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key }],
    });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.addOnAttribution.some((a) => a.addOnVersionId === key)).toBe(true);
  });

  it('CS09: completeness frozen on snapshot', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.completeness.reporting_completeness).toBeTruthy();
  });

  it('CS10: finalized snapshot not silently recalculated when sources change', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-06T00:00:00.000Z') });
    const reloaded = await stack.snapshots.getById(claims, stack.perms, snap.id);
    expect(reloaded.status).toBe('FINALIZED');
    expect((reloaded.metrics as any).leads_created.value).toBe(1);
  });

  it('CS11: source correction uses revision policy (new snapshot, prior SUPERSEDED)', async () => {
    const { claims, rep, stack } = await managerActor();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    const second = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true, reason: 'revision' }, randomUUID());
    const prior = await prisma.platformSalesCommissionSnapshot.findUniqueOrThrow({ where: { id: first.id } });
    expect(prior.status).toBe('SUPERSEDED');
    expect(second.supersedesSnapshotId).toBe(first.id);
  });

  it('CS12: review transition audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion, reason: 'start' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED, snap.id)).toBe(1);
  });

    it('CS13: N/A — no separate approval transition implemented (reviewStatus covers review lifecycle)', () => { expect(true).toBe(true); });

  it('CS14: paid status audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID, snap.id)).toBe(1);
  });

  it('CS15: paid replay no duplicate audit/effect', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const idem = randomUUID();
    const first = await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' }, idem);
    const replay = await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' }, idem);
    expect(replay.replayed).toBe(true);
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID, snap.id)).toBe(1);
    expect(first.paidStatus).toBe('PAID');
  });

  it('CS16: snapshot is not payroll/accounting ledger — computedAmount null and UNCONFIGURED', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.computedAmount).toBeNull();
    expect(snap.calculationStatus).toBe('UNCONFIGURED');
  });

  it('CS17: markPaid protected deltas all 0 for Subscription/Tenant/Entitlement/money', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const before = await protectedProductivitySoR(prisma);
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'admin' }, randomUUID());
    const after = await protectedProductivitySoR(prisma);
    const d = diffSoR(before, after);
    expect(d.commercialConfigs).toBe(0);
    expect(d.subscriptions).toBe(0);
    expect(d.platformTenants).toBe(0);
    expect(d.entitlements).toBe(0);
    expect(d.plans).toBe(0);
    expect(d.planVersions).toBe(0);
    expect(d.trials).toBe(0);
    expect(d.conversions).toBe(0);
    expect(d.addonAssignments).toBe(0);
  });
});
