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

describeDb('Step 26 productivity metrics M01–M20 (PostgreSQL)', () => {

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

  it('M01: leads_created counts leads with createdAt in period attributed to owner', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T10:00:00.000Z') });
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-04-01T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M01').value).toBe(1);
    expect(metricById(bundle, 'M01').completeness).toBe('COMPLETE');
  });

  it('M02: activities counts notes + demo updates + next-action updates in period', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id, createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T12:00:00.000Z'), demoStatus: 'SCHEDULED',
      demoScheduledAt: new Date('2026-03-09T12:00:00.000Z'), nextActionType: 'CALL',
    });
    await createLeadNote(prisma, lead.id, user.id, new Date('2026-03-07T09:00:00.000Z'));
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M02').value).toBeGreaterThanOrEqual(2);
  });

  it('M03: demos_scheduled counts demoScheduledAt in period', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id, demoStatus: 'SCHEDULED',
      demoScheduledAt: new Date('2026-03-15T14:00:00.000Z'), demoTimezone: 'UTC',
      createdAt: new Date('2026-03-01T01:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M03').value).toBe(1);
  });

  it('M04: demos_completed counts COMPLETED demos updated in period', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id, demoStatus: 'COMPLETED',
      demoScheduledAt: new Date('2026-03-10T10:00:00.000Z'),
      updatedAt: new Date('2026-03-18T11:00:00.000Z'), createdAt: new Date('2026-03-01T01:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M04').value).toBe(1);
  });

  it('M05: trials_created counts trials created in period for owner', async () => {
    const { user, rep, stack } = await managerActor();
    await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, createdAt: new Date('2026-03-11T08:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M05').value).toBe(1);
  });

  it('M06: won counts stage history WON entries in period', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, stage: 'WON', createdAt: new Date('2026-02-10T00:00:00.000Z') });
    await createStageHistory(prisma, { leadId: lead.id, toStage: 'WON', actorPlatformUserId: user.id, createdAt: new Date('2026-03-14T16:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M06').value).toBe(1);
  });

  it('M07: lost counts stage history LOST entries in period', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, stage: 'LOST', createdAt: new Date('2026-02-10T00:00:00.000Z') });
    await createStageHistory(prisma, { leadId: lead.id, toStage: 'LOST', actorPlatformUserId: user.id, createdAt: new Date('2026-03-16T16:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M07').value).toBe(1);
  });

  it('M08: paid_conversions credits frozen attributionSnapshot salesAttributionId', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-22T12:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M08').value).toBe(1);
  });

  it('M09: lead_to_won_rate is null with NOT_APPLICABLE when denominator is zero (never 0%)', async () => {
    const { rep, stack } = await managerActor();
    const m = metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }), 'M09');
    expect(m.value).toBeNull();
    expect(m.completeness).toBe('NOT_APPLICABLE');
    expect(m.rankingEligible).toBe(false);
  });

  it('M10: trial_to_paid_rate is null when trials_created denominator is zero', async () => {
    const { rep, stack } = await managerActor();
    const m = metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }), 'M10');
    expect(m.value).toBeNull();
    expect(m.completeness).toBe('NOT_APPLICABLE');
  });

  it('M11: time_to_convert_days is PARTIAL when sample size is under 3', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-01T00:00:00.000Z') });
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, originatingLeadId: lead.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-20T00:00:00.000Z') });
    const m = metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') }), 'M11');
    expect(m.value).not.toBeNull();
    expect(m.completeness).toBe('PARTIAL');
    expect(m.rankingEligible).toBe(false);
  });

  it('M12: active_customers counts owned tenants with current ACTIVE_COMMERCIAL config', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, { platformTenantId: platformTenant.id, createdByPlatformUserId: user.id, planVersionId: paidPlanVersionId, lifecycle: 'ACTIVE_COMMERCIAL' });
    expect(metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }), 'M12').value).toBe(1);
  });

  it('M13: cancellations counts owned configs cancelled in period', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, { platformTenantId: platformTenant.id, createdByPlatformUserId: user.id, planVersionId: paidPlanVersionId, lifecycle: 'CANCELLED', cancelledAt: new Date('2026-03-25T00:00:00.000Z') });
    expect(metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') }), 'M13').value).toBe(1);
  });

  it('M14: plan_version_mix maps immutable planVersionId counts for conversions', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.planVersionAttribution).toEqual([{ planVersionId: paidPlanVersionId, count: 1 }]);
    expect(metricById(bundle, 'M14').rankingEligible).toBe(false);
  });

  it('M15: addon_sales counts conversion dispositions migrate/retain once', async () => {
    const { user, rep, stack } = await managerActor();
    const addOnKey = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: addOnKey }],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M15').value).toBe(1);
  });

  it('M16: target_progress is NOT_APPLICABLE when target is missing (incomplete != zero)', async () => {
    const { rep, stack } = await managerActor();
    const m = metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }), 'M16');
    expect(m.value).toBeNull();
    expect(m.completeness).toBe('NOT_APPLICABLE');
    expect(m.rankingEligible).toBe(false);
  });

  it('M17: converted_customers counts distinct platformTenantId from attributed conversions', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, platformTenantId: platformTenant.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-22T00:00:00.000Z') });
    expect(metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') }), 'M17').value).toBe(1);
  });

  it('M18: cancellation_attribution records basis and PARTIAL completeness for current ownership', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, { platformTenantId: platformTenant.id, createdByPlatformUserId: user.id, planVersionId: paidPlanVersionId, lifecycle: 'CANCELLED', cancelledAt: new Date('2026-03-26T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M18').value).toBe(1);
    expect(bundle.cancellationAttribution.basis).toBe('current_ownership_partial');
  });

  it('M19: period_source_completeness is COMPLETE when critical sources are available', async () => {
    const { rep, stack } = await managerActor();
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY });
    expect(metricById(bundle, 'M19').completeness).toBe('COMPLETE');
  });

  it('M20: reporting_completeness gates ranking — incomplete rates are not rankingEligible', async () => {
    const { rep, stack } = await managerActor();
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY });
    expect(metricById(bundle, 'M20').completeness).toBe(bundle.completeness.reporting_completeness);
    for (const m of bundle.metrics.filter((x) => x.rankingEligible)) {
      expect(m.completeness).toBe('COMPLETE');
      expect(m.value).not.toBeNull();
    }
  });
});
