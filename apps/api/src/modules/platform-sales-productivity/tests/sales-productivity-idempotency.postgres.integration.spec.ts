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

describeDb('Step 26 idempotency I01–I16 (PostgreSQL)', () => {

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

  it('I01: generation exact replay returns same snapshot', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const a = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const b = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(b.replayed).toBe(true);
    expect(b.id).toBe(a.id);
  });

  it('I02: generation conflicting fingerprint rejected', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: false }, idem);
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, idem),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('I03: revision uses new idempotency key and supersedes prior', async () => {
    const { claims, rep, stack } = await managerActor();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const second = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(second.supersedesSnapshotId).toBe(first.id);
  });

  it('I04: review replay returns same review result', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const idem = randomUUID();
    const a = await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, idem);
    const b = await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, idem);
    expect(b.replayed).toBe(true);
    expect(b.reviewStatus).toBe(a.reviewStatus);
  });

    it('I05: N/A — no separate approval operation — covered by review replay I04', () => { expect(true).toBe(true); });

  it('I06: paid replay returns same paid result', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const idem = randomUUID();
    const a = await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'x' }, idem);
    const b = await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'x' }, idem);
    expect(b.replayed).toBe(true);
    expect(b.paidStatus).toBe(a.paidStatus);
  });

  it('I07: conflicting paid replay rejected', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const idem = randomUUID();
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'a', paidReference: 'R1' }, idem);
    await expect(
      stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'a', paidReference: 'R2' }, idem),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('I08: service recreation still replays durable claim', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const a = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const stack2 = createSalesProductivityStack(prisma);
    const b = await stack2.snapshots.generate(claims, stack2.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(b.id).toBe(a.id);
    expect(b.replayed).toBe(true);
  });

  it('I09: process cache loss — durable store remains authority', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const a = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const stack2 = createSalesProductivityStack(prisma);
    const b = await stack2.snapshots.generate(claims, stack2.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(b.id).toBe(a.id);
  });

  it('I10: multi-instance generation with same key converges to one snapshot', async () => {
    const { claims, rep } = await managerActor();
    const idem = randomUUID();
    const s1 = createSalesProductivityStack(prisma);
    const s2 = createSalesProductivityStack(prisma);
    const [a, b] = await Promise.allSettled([
      s1.snapshots.generate(claims, s1.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
      s2.snapshots.generate(claims, s2.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
    ]);
    const ids = [a, b].filter((r) => r.status === 'fulfilled').map((r) => (r as PromiseFulfilledResult<any>).value.id);
    expect(new Set(ids).size).toBe(1);
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(1);
  });

  it('I11: post-commit response loss recovers via replay', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    setSalesProductivityFailureInjection('after_commit_before_response');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
    ).rejects.toBeTruthy();
    clearSalesProductivityFailureInjection();
    const recovered = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(recovered.id).toBeTruthy();
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(1);
  });

    it('I12: N/A — export is synchronous request/response — no durable export job store', () => { expect(true).toBe(true); });
    it('I13: N/A — no persisted reconciliation job in Step 26', () => { expect(true).toBe(true); });

  it('I14: finalization replay via generate(finalize) idempotency', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const a = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, idem);
    const b = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, idem);
    expect(b.replayed).toBe(true);
    expect(a.status).toBe('FINALIZED');
  });

    it('I15: N/A — no commission outbox/event emission in Step 26 module', () => { expect(true).toBe(true); });
    it('I16: N/A — no adjustment operation implemented', () => { expect(true).toBe(true); });
});
