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

describeDb('Step 26 visibility V01–V16 (PostgreSQL)', () => {

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

  it('V01: self-view allowed for representative with sales-report.view', async () => {
    const { claims, stack } = await repActor();
    const bundle = await stack.query.self(claims, stack.perms, PERIOD_KEY);
    expect(bundle.periodKey).toBe(PERIOD_KEY);
  });

  it('V02: peer metrics denied for representative scope', async () => {
    const peer = await repActor();
    const self = await repActor();
    await expect(self.stack.query.team(self.claims, self.stack.perms, { periodKey: PERIOD_KEY, representativeId: peer.rep.id }))
      .rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V03: peer snapshot denied for representative scope', async () => {
    const mgr = await managerActor();
    const peer = await repActor();
    const self = await repActor();
    // Snapshot belongs to peer; another representative (self) must not read it by id.
    const snap = await mgr.stack.snapshots.generate(mgr.claims, mgr.stack.perms, { representativeId: peer.rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await expect(self.stack.snapshots.getById(self.claims, self.stack.perms, snap.id))
      .rejects.toBeInstanceOf(SalesProductivityNotFoundError);
  });

  it('V04: self export own rows only', async () => {
    const a = await repActor();
    const b = await repActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: a.rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    await createLeadFixture(prisma, { ownerRepresentativeId: b.rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).toContain(a.rep.id);
    expect(file.body).not.toContain(b.rep.id);
  });

  it('V05: peer totals cannot be inferred from self export', async () => {
    const a = await repActor();
    const b = await repActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: b.rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body.split('\n').filter((l) => l.includes(b.rep.id)).length).toBe(0);
  });

  it('V06: direct snapshot ID cannot bypass scope', async () => {
    const mgr = await managerActor();
    const peer = await repActor();
    const snap = await mgr.stack.snapshots.generate(mgr.claims, mgr.stack.perms, { representativeId: peer.rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const outsider = await repActor();
    await expect(outsider.stack.snapshots.getById(outsider.claims, outsider.stack.perms, snap.id))
      .rejects.toBeInstanceOf(SalesProductivityNotFoundError);
  });

  it('V07: authorized manager sees permitted team subtree scope', async () => {
    const mgr = await managerActor();
    const report = await repActor({ managerRepresentativeId: mgr.rep.id });
    await createLeadFixture(prisma, { ownerRepresentativeId: report.rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const team = await mgr.stack.query.team(mgr.claims, mgr.stack.perms, { periodKey: PERIOD_KEY });
    expect(team.items.some((i) => i.representativeId === report.rep.id)).toBe(true);
  });

  it('V08: manager outside scope denied for foreign representativeId filter', async () => {
    const mgrA = await managerActor();
    const mgrB = await managerActor();
    const foreign = await repActor({ managerRepresentativeId: mgrB.rep.id });
    // mgrA has manage+generate => all scope; use review-only perms to force team scope
    const limited = createSalesProductivityStack(prisma, {
      permissions: [
        SALES_PRODUCTIVITY_PERMISSIONS.reportView,
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotView,
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview,
        SALES_PRODUCTIVITY_PERMISSIONS.representativeManage,
      ],
    });
    // Without generate, manage alone => team; mgrA team should not include foreign under mgrB
    await expect(
      limited.query.team(mgrA.claims, limited.perms, { periodKey: PERIOD_KEY, representativeId: foreign.rep.id }),
    ).rejects.toBeInstanceOf(SalesProductivityNotFoundError);
  });

  it('V09: explicit global permission (manage+generate) works for all reps', async () => {
    const mgr = await managerActor();
    const peer = await repActor();
    const team = await mgr.stack.query.team(mgr.claims, mgr.stack.perms, { periodKey: PERIOD_KEY });
    expect(team.items.some((i) => i.representativeId === peer.rep.id)).toBe(true);
  });

  it('V10: commission review permission required for review transition', async () => {
    const mgr = await managerActor();
    const snap = await mgr.stack.snapshots.generate(mgr.claims, mgr.stack.perms, { representativeId: mgr.rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const noReview = createSalesProductivityStack(prisma, {
      permissions: [
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotView,
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate,
        SALES_PRODUCTIVITY_PERMISSIONS.representativeManage,
      ],
    });
    await expect(
      noReview.snapshots.review(mgr.claims, noReview.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, randomUUID()),
    ).rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V11: paid-status permission separate from review/generate', async () => {
    const mgr = await managerActor();
    const snap = await mgr.stack.snapshots.generate(mgr.claims, mgr.stack.perms, { representativeId: mgr.rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const noPaid = createSalesProductivityStack(prisma, {
      permissions: [
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotView,
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotReview,
        SALES_PRODUCTIVITY_PERMISSIONS.snapshotGenerate,
        SALES_PRODUCTIVITY_PERMISSIONS.representativeManage,
      ],
    });
    await expect(
      noPaid.snapshots.markPaid(mgr.claims, noPaid.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'x' }, randomUUID()),
    ).rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V12: suspended representative denied self productivity', async () => {
    const suspended = await repActor({ status: 'SUSPENDED' });
    await expect(suspended.stack.query.self(suspended.claims, suspended.stack.perms, PERIOD_KEY))
      .rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V13: Clinic principal denied', async () => {
    const { user, session, stack } = await managerActor();
    const { JwtClaimsVO } = await import('../../auth/domain/value-objects/jwt-claims.vo');
    const claims = new JwtClaimsVO({
      sub: user.id,
      tenantId: randomUUID(),
      branchId: null,
      roles: ['clinic_admin'] as never,
      sessionId: session.sessionId,
      sessionClass: 'staff' as never,
      principalType: 'clinic' as never,
      aud: 'clinic',
      iss: 'booking-clinic',
    });
    await expect(stack.query.self(claims, stack.perms, PERIOD_KEY)).rejects.toBeInstanceOf(
      SalesProductivityForbiddenError,
    );
  });

  it('V14: role-name bypass denied — missing sales-report.view fails even with sales_manager claim string absent from DB perms set', async () => {
    const { claims } = await managerActor();
    const bare = createSalesProductivityStack(prisma, { permissions: [] });
    await expect(bare.query.self(claims, bare.perms, PERIOD_KEY)).rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V15: wildcard-intent bypass denied — no permission set grants via wildcard', async () => {
    const { claims } = await managerActor();
    const bare = createSalesProductivityStack(prisma, { permissions: ['*'] as never });
    await expect(bare.query.self(claims, new Set(['*']), PERIOD_KEY)).rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('V16: search/filter cannot widen scope beyond visibility', async () => {
    const a = await repActor();
    const b = await repActor();
    await expect(a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY, representativeId: b.rep.id }))
      .rejects.toBeInstanceOf(SalesProductivityNotFoundError);
  });
});
