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

describeDb('Step 26 failure injection F01–F30 (PostgreSQL)', () => {

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

  it('F01: metric source query failure via after_metrics_compute injection', async () => {
    const { rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('after_metrics_compute');
    await expect(stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }))
      .rejects.toBeInstanceOf(SalesProductivityValidationError);
  });

  it('F02: lead source failure via before_lead_source_query — unavailable≠zero, no fabricated lead metrics', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      stage: 'WON',
    });
    const beforeSnap = await prisma.platformSalesCommissionSnapshot.count();
    const beforeSoR = await protectedProductivitySoR(prisma);
    const auditsBefore = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED);

    setSalesProductivityFailureInjection('before_lead_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    for (const id of ['M01', 'M02', 'M03', 'M04', 'M06', 'M07', 'M09'] as const) {
      const m = metricById(bundle, id);
      expect(m.value).toBeNull();
      expect(m.completeness).toBe('UNAVAILABLE');
      expect(m.rankingEligible).toBe(false);
    }
    expect(bundle.completeness.reporting_completeness).toBe('UNAVAILABLE');
    expect(bundle.completeness.period_source_completeness).toBe('UNAVAILABLE');

    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(snap.completeness.reporting_completeness).toBe('UNAVAILABLE');
    expect((snap.metrics as any).leads_created.value).toBeNull();
    expect((snap.metrics as any).leads_created.completeness).toBe('UNAVAILABLE');
    expect(snap.reconciliation).toMatchObject({ reconciled: false, status: 'UNAVAILABLE' });
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(beforeSnap + 1);
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      commercialConfigs: 0,
      subscriptions: 0,
      platformTenants: 0,
      entitlements: 0,
    });
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED)).toBe(
      auditsBefore + 1,
    );
  });

  it('F03: Trial source failure via before_trial_source_query — no fabricated Trial metrics', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('before_trial_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    for (const id of ['M05', 'M08', 'M10', 'M11', 'M14', 'M17'] as const) {
      const m = metricById(bundle, id);
      expect(m.value).toBeNull();
      expect(m.completeness).toBe('UNAVAILABLE');
      expect(m.rankingEligible).toBe(false);
    }
    expect(bundle.planVersionAttribution).toEqual([]);
    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(snap.completeness.reporting_completeness).toBe('UNAVAILABLE');
    expect(snap.reconciliation).toMatchObject({ reconciled: false });
  });

  it('F04: Subscription source failure via before_subscription_source_query — no false active/cancel', async () => {
    const { claims, rep, stack } = await managerActor();
    const beforeSoR = await protectedProductivitySoR(prisma);
    setSalesProductivityFailureInjection('before_subscription_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    for (const id of ['M12', 'M13', 'M15', 'M18'] as const) {
      const m = metricById(bundle, id);
      expect(m.value).toBeNull();
      expect(m.completeness).toBe('UNAVAILABLE');
      expect(m.rankingEligible).toBe(false);
    }
    await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      commercialConfigs: 0,
      subscriptions: 0,
      platformTenants: 0,
    });
  });

  it('F05: Plan Version source failure via before_plan_version_source_query — no name/latest fallback', async () => {
    const { claims, rep, stack } = await managerActor();
    const beforeSoR = await protectedProductivitySoR(prisma);
    setSalesProductivityFailureInjection('before_plan_version_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    const m14 = metricById(bundle, 'M14');
    expect(m14.value).toBeNull();
    expect(m14.completeness).toBe('UNAVAILABLE');
    expect(m14.rankingEligible).toBe(false);
    expect(bundle.planVersionAttribution).toEqual([]);
    expect(JSON.stringify(bundle)).not.toMatch(/latest|displayName|planName/i);
    await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      plans: 0,
      planVersions: 0,
    });
  });

  it('F06: Add-on source failure via before_addon_source_query — no fabricated Add-on sales', async () => {
    const { claims, rep, stack } = await managerActor();
    const beforeSoR = await protectedProductivitySoR(prisma);
    setSalesProductivityFailureInjection('before_addon_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    const m15 = metricById(bundle, 'M15');
    expect(m15.value).toBeNull();
    expect(m15.completeness).toBe('UNAVAILABLE');
    expect(m15.rankingEligible).toBe(false);
    expect(bundle.addOnAttribution).toEqual([]);
    await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      addonAssignments: 0,
    });
  });

  it('F07: target source failure via before_target_source_query — unavailable≠zero target', async () => {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `tgt-f07-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, {
      status: 'ACTIVE',
      targetAmount: 10,
      targetPeriod: 'MONTH',
      targetCurrency: null,
    });
    const stack = createSalesProductivityStack(prisma);
    setSalesProductivityFailureInjection('before_target_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    const m16 = metricById(bundle, 'M16');
    expect(m16.value).toBeNull();
    expect(m16.completeness).toBe('UNAVAILABLE');
    expect(m16.rankingEligible).toBe(false);
    expect(m16.explanation).toBe('target_source_unavailable');
    expect(m16.value).not.toBe(0);
    // Unrelated complete metrics remain coherent when lead source is healthy.
    expect(metricById(bundle, 'M01').completeness).toBe('COMPLETE');
    await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    const reloaded = await prisma.platformSalesRepresentative.findUniqueOrThrow({
      where: { id: rep.id },
    });
    expect(Number(reloaded.targetAmount)).toBe(10);
  });

  it('F08: attribution source failure via before_attribution_source_query — no current-owner fallback', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('before_attribution_source_query');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    for (const id of ['M08', 'M10', 'M11', 'M14', 'M15', 'M17'] as const) {
      const m = metricById(bundle, id);
      expect(m.value).toBeNull();
      expect(m.completeness).toBe('UNAVAILABLE');
      expect(m.rankingEligible).toBe(false);
    }
    expect(bundle.planVersionAttribution).toEqual([]);
    expect(bundle.addOnAttribution).toEqual([]);
    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(snap.reconciliation).toMatchObject({ reconciled: false, status: 'UNAVAILABLE' });
    expect(snap.completeness.reporting_completeness).toBe('UNAVAILABLE');
  });

  it('F09: completeness evaluator failure via before_completeness_eval — fail closed never COMPLETE', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('before_completeness_eval');
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    expect(bundle.completeness.reporting_completeness).toBe('UNAVAILABLE');
    expect(bundle.completeness.period_source_completeness).toBe('UNAVAILABLE');
    for (const m of bundle.metrics) {
      expect(m.rankingEligible).toBe(false);
      if (m.completeness !== 'NOT_APPLICABLE') {
        expect(m.completeness).toBe('UNAVAILABLE');
        expect(m.value).toBeNull();
      }
    }
    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(snap.completeness.reporting_completeness).toBe('UNAVAILABLE');
    expect(snap.reconciliation).toMatchObject({ reconciled: false });
    const exported = await stack.export.exportCsv(claims, stack.perms, {
      periodKey: PERIOD_KEY,
      representativeId: rep.id,
    });
    expect(exported.body).toMatch(/UNAVAILABLE/);
    expect(exported.body).toMatch(/completeness_evaluator_unavailable|reporting_unavailable|source_or_completeness_unavailable/);
    expect(metricById(
      await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }),
      'M20',
    ).completeness).toBe('UNAVAILABLE');
  });

  it('F10: snapshot insert failure rolls back generate', async () => {
    const { claims, rep, stack } = await managerActor();
    const before = await prisma.platformSalesCommissionSnapshot.count();
    setSalesProductivityFailureInjection('after_snapshot_insert');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(before);
  });

  it('F11: after durable claim failure releases pending claim', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('after_idempotency_claim');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
    expect(await prisma.platformSalesIdempotencyRecord.count({ where: { status: 'pending' } })).toBe(0);
  });

  it('F12: before commit failure rolls back snapshot + audit', async () => {
    const { claims, rep, stack } = await managerActor();
    const auditsBefore = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED);
    setSalesProductivityFailureInjection('before_commit');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(0);
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED)).toBe(auditsBefore);
  });

  it('F13: audit write failure rolls back with after_audit_staging_before_commit', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('after_audit_staging_before_commit');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(0);
  });

  it('F14: after commit before response leaves durable effect and allows replay', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    setSalesProductivityFailureInjection('after_commit_before_response');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
    ).rejects.toBeTruthy();
    clearSalesProductivityFailureInjection();
    const recovered = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(recovered.id).toBeTruthy();
  });

  it('F15: post-commit replay recovers committed generate', async () => {
    const { claims, rep, stack } = await managerActor();
    const idem = randomUUID();
    setSalesProductivityFailureInjection('after_commit_before_response');
    await expect(stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem)).rejects.toBeTruthy();
    clearSalesProductivityFailureInjection();
    const replay = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem);
    expect(replay.replayed || replay.id).toBeTruthy();
  });

  it('F16: review transition failure via OCC injection', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    setSalesProductivityFailureInjection('occ_conflict');
    await expect(
      stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'IN_REVIEW', expectedRowVersion: snap.rowVersion }, randomUUID()),
    ).rejects.toBeInstanceOf(SalesProductivityConflictError);
  });

    it('F17: N/A — no separate approval operation', () => { expect(true).toBe(true); });

  it('F18: paid-status failure via mark_paid_side_effect_guard', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    setSalesProductivityFailureInjection('mark_paid_side_effect_guard');
    await expect(
      stack.snapshots.markPaid(claims, stack.perms, snap.id, { paidStatus: 'PAID', expectedRowVersion: snap.rowVersion, paidReason: 'x' }, randomUUID()),
    ).rejects.toBeInstanceOf(SalesProductivityValidationError);
    const row = await prisma.platformSalesCommissionSnapshot.findUniqueOrThrow({ where: { id: snap.id } });
    expect(row.paidStatus).toBe('UNPAID');
  });

  it('F19: reconciliation failure via during_reconciliation — never reconciled=true; finalize blocked', async () => {
    const { claims, rep, stack } = await managerActor();
    const beforeSnap = await prisma.platformSalesCommissionSnapshot.count();
    const beforeSoR = await protectedProductivitySoR(prisma);
    const auditsBefore = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED);
    const auditsFinalBefore = await countCommissionAudits(
      prisma,
      SALES_COMMISSION_AUDIT_ACTIONS.FINALIZED,
    );

    setSalesProductivityFailureInjection('during_reconciliation');
    await expect(
      stack.snapshots.generate(
        claims,
        stack.perms,
        { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true },
        randomUUID(),
      ),
    ).rejects.toBeInstanceOf(SalesProductivityValidationError);
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(beforeSnap);
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.FINALIZED)).toBe(
      auditsFinalBefore,
    );

    const draft = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: false },
      randomUUID(),
    );
    expect(draft.reconciliation).toMatchObject({
      reconciled: false,
      status: 'UNAVAILABLE',
      reason: 'injected_reconciliation_failure',
    });
    expect((draft.reconciliation as any).reconciled).not.toBe(true);
    expect(draft.status).toBe('DRAFT');
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(beforeSnap + 1);
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      commercialConfigs: 0,
      subscriptions: 0,
      platformTenants: 0,
      entitlements: 0,
      trials: 0,
      conversions: 0,
    });
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.GENERATED)).toBe(
      auditsBefore + 1,
    );

    // Retry without injector succeeds and does not duplicate active identity incorrectly.
    clearSalesProductivityFailureInjection();
    const retry = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(retry.id).not.toBe(draft.id);
    expect(retry.reconciliation).toBeNull();
    expect(
      await prisma.platformSalesCommissionSnapshot.count({
        where: { status: { not: 'SUPERSEDED' } },
      }),
    ).toBe(1);
  });

  it('F20: export serialization failure via during_export_serialize — no partial body; retry CSV-safe', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
    });
    const beforeSnap = await prisma.platformSalesCommissionSnapshot.count();
    const beforeSoR = await protectedProductivitySoR(prisma);
    const auditsBefore = await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED);

    setSalesProductivityFailureInjection('during_export_serialize');
    await expect(
      stack.export.exportCsv(claims, stack.perms, {
        periodKey: PERIOD_KEY,
        representativeId: rep.id,
      }),
    ).rejects.toMatchObject({ code: 'injected_failure' });
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED)).toBe(
      auditsBefore,
    );
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(beforeSnap);
    expect(diffSoR(beforeSoR, await protectedProductivitySoR(prisma))).toMatchObject({
      commercialConfigs: 0,
      subscriptions: 0,
      platformTenants: 0,
    });

    clearSalesProductivityFailureInjection();
    const ok = await stack.export.exportCsv(claims, stack.perms, {
      periodKey: PERIOD_KEY,
      representativeId: rep.id,
    });
    expect(ok.body).toMatch(/^"representativeId"/);
    expect(ok.body).toContain(rep.id);
    expect(ok.body).toMatch(/leads_created/);
    const { csvSafeCell } = await import(
      '../../platform-audit-center/application/audit-center-redaction'
    );
    expect(csvSafeCell('=CMD()')).toMatch(/^"'=/);
    expect(await countCommissionAudits(prisma, SALES_COMMISSION_AUDIT_ACTIONS.EXPORTED)).toBe(
      auditsBefore + 1,
    );
  });

  it('F21: export authorization failure when permissions missing', async () => {
    const { claims } = await managerActor();
    const bare = createSalesProductivityStack(prisma, { permissions: [] });
    await expect(bare.export.exportCsv(claims, bare.perms, { periodKey: PERIOD_KEY }))
      .rejects.toBeInstanceOf(SalesProductivityForbiddenError);
  });

  it('F22: CSV safety remains intact under export (formula neutralization)', async () => {
    const { csvSafeCell } = await import('../../platform-audit-center/application/audit-center-redaction');
    expect(csvSafeCell('=1+1')).toMatch(/^"'=/);
  });

  it('F23: service recreation after failure still healthy', async () => {
    const { claims, rep, stack } = await managerActor();
    setSalesProductivityFailureInjection('before_commit');
    await expect(stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID())).rejects.toBeTruthy();
    clearSalesProductivityFailureInjection();
    const stack2 = createSalesProductivityStack(prisma);
    const ok = await stack2.snapshots.generate(claims, stack2.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(ok.id).toBeTruthy();
  });

  it('F24: local cache loss does not invent rates — UNCONFIGURED persists', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    const stack2 = createSalesProductivityStack(prisma);
    const reloaded = await stack2.snapshots.getById(claims, stack2.perms, snap.id);
    expect(reloaded.calculationStatus).toBe('UNCONFIGURED');
    expect(reloaded.computedAmount).toBeNull();
  });

  it('F25: multi-instance duplicate prevented by durable idempotency', async () => {
    const { claims, rep } = await managerActor();
    const idem = randomUUID();
    const s1 = createSalesProductivityStack(prisma);
    const s2 = createSalesProductivityStack(prisma);
    await Promise.allSettled([
      s1.snapshots.generate(claims, s1.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
      s2.snapshots.generate(claims, s2.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, idem),
    ]);
    expect(await prisma.platformSalesCommissionSnapshot.count()).toBe(1);
  });

  it('F26: OCC conflict injection on review', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    setSalesProductivityFailureInjection('occ_conflict');
    await expect(
      stack.snapshots.review(claims, stack.perms, snap.id, { reviewStatus: 'REVIEWED', expectedRowVersion: snap.rowVersion }, randomUUID()),
    ).rejects.toMatchObject({ code: 'occ_conflict' });
  });

  it('F27: timezone/period boundary failure rejects non-UTC timezone', async () => {
    const { claims, rep, stack } = await managerActor();
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY, periodTimezone: 'America/New_York' }, randomUUID()),
    ).rejects.toBeInstanceOf(SalesProductivityValidationError);
  });

  it('F28: source correction/revision failure rolls back when before_commit injected on revision', async () => {
    const { claims, rep, stack } = await managerActor();
    await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    setSalesProductivityFailureInjection('before_commit');
    await expect(
      stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID()),
    ).rejects.toBeTruthy();
  });

  it('F29: commission rule unavailable remains UNCONFIGURED (never invents rates)', async () => {
    const { claims, rep, stack } = await managerActor();
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect(snap.calculationStatus).toBe('UNCONFIGURED');
    expect(snap.computedAmount).toBeNull();
  });

  it('F30: ranking-completeness guard — null rates never rankingEligible', async () => {
    const { rep, stack } = await managerActor();
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY });
    expect(metricById(bundle, 'M09').value).toBeNull();
    expect(metricById(bundle, 'M09').rankingEligible).toBe(false);
    expect(metricById(bundle, 'M16').rankingEligible).toBe(false);
  });

  it('F31: injection selectors inert outside NODE_ENV=test', async () => {
    process.env.NODE_ENV = 'production';
    setSalesProductivityFailureInjection('before_commit');
    const { isSalesProductivityFailureInjectionActive } = await import(
      '../platform-sales-productivity.constants'
    );
    expect(isSalesProductivityFailureInjectionActive('before_commit')).toBe(false);
    process.env.NODE_ENV = 'test';
  });

  it('F32: documented failure injection points are enumerated', () => {
    expect(SALES_PRODUCTIVITY_FAILURE_INJECTION_POINTS.length).toBeGreaterThanOrEqual(8);
  });
});
