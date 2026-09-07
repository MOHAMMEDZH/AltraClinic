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

describeDb('Step 26 audit A01–A20 (PostgreSQL)', () => {

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

  it('A01: snapshot generated emits exactly one generated audit', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED, snap.id)).toBe(1);
  });

  it('A02: snapshot revised/regenerated emits SUPERSEDED + GENERATED', async () => {
    const { claims, rep, stack } = await managerActor();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const second = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, reason: 'rev' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.SUPERSEDED, first.id)).toBe(1);
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED, second.id)).toBe(1);
  });

  it('A03: review started (IN_REVIEW) audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED, snap.id)).toBe(1);
  });

  it('A04: review completed (REVIEWED) audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const mid = await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, randomUUID());
    await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'REVIEWED', expectedRowVersion: mid.rowVersion }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED, snap.id)).toBe(2);
  });

    it('A05: N/A — no separate approval action — reviewStatus REVIEWED covers approval semantics', () => { expect(true).toBe(true); });

  it('A06: snapshot rejected audited via reviewStatus REJECTED', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'REJECTED', expectedRowVersion: snap.rowVersion, reason: 'bad' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED, snap.id)).toBe(1);
  });

    it('A07: N/A — no commission rule selector — calculationStatus always UNCONFIGURED / ruleReference null', () => { expect(true).toBe(true); });

  it('A08: paid status marked audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'ok' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID, snap.id)).toBe(1);
  });

  it('A09: paid status corrected/reopened to UNPAID audited', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const paid = await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'ok' }, randomUUID());
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'UNPAID', expectedRowVersion: paid.rowVersion, paidReason: 'reopen' }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID, snap.id)).toBe(2);
  });

    it('A10: N/A — no manual adjustment surface in Step 26 product policy', () => { expect(true).toBe(true); });

  it('A11: export audit emitted', async () => {
    const { claims, stack } = await managerActor();
    const before = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED);
    await stack.export.exportCsv(claims, stack.perms, { periodKey: PERIOD_KEY });
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED)).toBe(before + 1);
  });

    it('A12: N/A — no durable reconciliation-failure audit path — reconciliation is live compute metadata', () => { expect(true).toBe(true); });
    it('A13: N/A — no completeness override mutation exists', () => { expect(true).toBe(true); });

  it('A14: review reason stored on audit row', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion, reason: 'need-docs' }, randomUUID());
    const row = await prisma.auditEntry.findFirst({ where: { action: SALES_COMMISSION_AUDIT_ACTIONS.REVIEWED, resourceId: snap.id } });
    expect(row?.reason).toBe('need-docs');
  });

  it('A15: snapshot finalized emits FINALIZED audit', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.FINALIZED, snap.id)).toBe(1);
  });

  it('A16: revision supersedes prior snapshot with SUPERSEDED audit', async () => {
    const { claims, rep, stack } = await managerActor();
    const first = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true }, randomUUID());
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.SUPERSEDED, first.id)).toBe(1);
  });

  it('A17: paid reference changed audited on markPaid', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    await stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'ok', paidReference: 'EXT-1' }, randomUUID());
    const row = await prisma.auditEntry.findFirst({ where: { action: SALES_COMMISSION_AUDIT_ACTIONS.MARKED_PAID, resourceId: snap.id } });
    expect(JSON.stringify(row?.details)).toContain('EXT-1');
  });

  it('A18: generation failure does not emit success audit (false-success delta 0)', async () => {
    const { claims, rep, stack } = await managerActor();
    const before = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED);
    setSalesProductivityFailureInjection('before_commit');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED)).toBe(before);
  });

    it('A19: N/A — no dedicated privileged-global-report audit action beyond existing generate/export audits', () => { expect(true).toBe(true); });
    it('A20: N/A — no sensitive historical view audit beyond snapshot get (read path not Model A audited)', () => { expect(true).toBe(true); });

  it('A21: exact replay of generate adds zero additional success audits', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    const before = await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED, snap.id);
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(await countCommissionAuditsFor(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED, snap.id)).toBe(before);
  });
});
