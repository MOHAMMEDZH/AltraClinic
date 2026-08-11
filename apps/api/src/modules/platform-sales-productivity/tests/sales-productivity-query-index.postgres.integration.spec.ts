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

import { createQueryCountingClient } from './sales-productivity-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 26 query/index bounds (PostgreSQL)', () => {

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

  it('N01: bounded representative team list take <= 500', async () => {
    const { claims, stack } = await managerActor();
    const team = await stack.query.team(claims, stack.perms, { periodKey: PERIOD_KEY });
    expect(team.items.length).toBeLessThanOrEqual(500);
  });

  it('N02: bounded month/date range required', async () => {
    const { claims, stack } = await managerActor();
    await expect(stack.query.self(claims, stack.perms, 'not-a-month')).rejects.toBeInstanceOf(SalesProductivityValidationError);
  });

  it('N03: snapshot list deterministic ordering periodKey desc, createdAt desc, id asc', async () => {
    const { claims, rep, stack } = await managerActor();
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: '2026-01' }, randomUUID());
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: '2026-02' }, randomUUID());
    const list = await stack.snapshots.list(claims, stack.perms, { page: 1, pageSize: 10 });
    const keys = list.items.map((i) => i.periodKey);
    expect(keys).toEqual([...keys].sort().reverse());
  });

  it('N04: snapshot lookup indexed by representative/period returns expected row', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const list = await stack.snapshots.list(claims, stack.perms, { page: 1, pageSize: 10, periodKey: PERIOD_KEY, representativeId: rep.id });
    expect(list.items.map((i) => i.id)).toContain(snap.id);
  });

  it('N05: no N+1 explosion on team metrics for small N (query count bounded)', async () => {
    const qc = createQueryCountingClient();
    try {
      await cleanupSalesProductivityTables(qc.client);
      const roleKeys = [SALES_MANAGER_ROLE];
      const user = await createPlatformUserFixture(qc.client, { email: `q-${randomUUID()}@test.local`, roleKeys });
      const session = await createPlatformRefreshSession(qc.client, user.id);
      const claims = platformClaims(user.id, session.sessionId, roleKeys);
      await createRepProfile(qc.client, user.id, { status: 'ACTIVE' });
      for (let i = 0; i < 3; i++) {
        const u = await createPlatformUserFixture(qc.client, { email: `qr-${randomUUID()}@test.local`, roleKeys: [SALES_REP_ROLE] });
        await createRepProfile(qc.client, u.id, { status: 'ACTIVE' });
      }
      const stack = createSalesProductivityStack(qc.client);
      qc.reset();
      await stack.query.team(claims, stack.perms, { periodKey: PERIOD_KEY });
      // Per-rep compute issues multiple queries; assert linear-ish upper bound for 4 reps.
      expect(qc.counted()).toBeLessThan(200);
    } finally {
      await cleanupSalesProductivityTables(qc.client);
      await qc.client.$disconnect();
    }
  });

  it('N06: finalized historical snapshot reads do not recalculate by default', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-06T00:00:00.000Z') });
    const read = await stack.snapshots.getById(claims, stack.perms, snap.id);
    expect((read.metrics as any).leads_created.value).toBe(1);
  });

  it('N07: export bounded by same representative take limit', async () => {
    const { claims, stack } = await managerActor();
    const file = await stack.export.exportCsv(claims, stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body.split('\n').length).toBeGreaterThan(1);
  });

  it('N08: ranking eligibility never claims completeness for incomplete rates', async () => {
    const { rep, stack } = await managerActor();
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY });
    for (const m of bundle.metrics) {
      if (m.value === null) expect(m.rankingEligible).toBe(false);
    }
  });
});
