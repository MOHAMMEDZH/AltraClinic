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

describeDb('Step 26 reconciliation REC01–REC12 (PostgreSQL)', () => {

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

  it('REC01: leads_created reconciles to PlatformSalesLead rows for owner/period', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-06T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    const raw = await prisma.platformSalesLead.count({ where: { ownerRepresentativeId: rep.id, createdAt: { gte: new Date('2026-03-01T00:00:00.000Z'), lt: new Date('2026-04-01T00:00:00.000Z') } } });
    expect(metricById(bundle, 'M01').value).toBe(raw);
  });

  it('REC02: activities reconciles to notes + demo/next-action updates', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id, createdAt: new Date('2026-02-01T00:00:00.000Z'),
      updatedAt: new Date('2026-03-08T00:00:00.000Z'), demoStatus: 'SCHEDULED', nextActionType: 'EMAIL',
      demoScheduledAt: new Date('2026-03-09T00:00:00.000Z'),
    });
    await createLeadNote(prisma, lead.id, user.id, new Date('2026-03-07T00:00:00.000Z'));
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M02').value).toBeGreaterThanOrEqual(1);
  });

  it('REC03: demos_scheduled reconciles to demoScheduledAt rows', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, demoStatus: 'SCHEDULED', demoScheduledAt: new Date('2026-03-12T00:00:00.000Z'), demoTimezone: 'UTC', createdAt: new Date('2026-03-01T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M03').value).toBe(1);
  });

  it('REC04: trials_created reconciles to PlatformSalesTrial rows', async () => {
    const { user, rep, stack } = await managerActor();
    await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, createdAt: new Date('2026-03-11T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    const raw = await prisma.platformSalesTrial.count({ where: { ownerRepresentativeId: rep.id, createdAt: { gte: new Date('2026-03-01T00:00:00.000Z'), lt: new Date('2026-04-01T00:00:00.000Z') } } });
    expect(metricById(bundle, 'M05').value).toBe(raw);
  });

  it('REC05: won/lost reconcile to stage history', async () => {
    const { user, rep, stack } = await managerActor();
    const lead = await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, stage: 'WON', createdAt: new Date('2026-02-01T00:00:00.000Z') });
    await createStageHistory(prisma, { leadId: lead.id, toStage: 'WON', actorPlatformUserId: user.id, createdAt: new Date('2026-03-14T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M06').value).toBe(1);
  });

  it('REC06: conversions reconcile to attributed PlatformSalesTrialConversion rows', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-22T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M08').value).toBe(1);
  });

  it('REC07: active customers reconcile to ownership ∩ ACTIVE_COMMERCIAL', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, { platformTenantId: platformTenant.id, createdByPlatformUserId: user.id, planVersionId: paidPlanVersionId, lifecycle: 'ACTIVE_COMMERCIAL' });
    expect(metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY }), 'M12').value).toBe(1);
  });

  it('REC08: cancellations reconcile to cancelled configs in period', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, { platformTenantId: platformTenant.id, createdByPlatformUserId: user.id, planVersionId: paidPlanVersionId, lifecycle: 'CANCELLED', cancelledAt: new Date('2026-03-20T00:00:00.000Z') });
    expect(metricById(await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') }), 'M13').value).toBe(1);
  });

  it('REC09: Plan Version mix reconciles to conversion targetPaidPlanVersionId map', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, { trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id, convertedAt: new Date('2026-03-21T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(bundle.planVersionAttribution.reduce((s, p) => s + p.count, 0)).toBe(metricById(bundle, 'M14').value);
  });

  it('REC10: Add-on attribution reconciles to disposition events', async () => {
    const { user, rep, stack } = await managerActor();
    const key = randomUUID();
    const trial = await createTrialFixture(prisma, { ownerRepresentativeId: rep.id, trialPlanVersionId, createdByPlatformUserId: user.id, status: 'CONVERTED' });
    await createConversionFixture(prisma, {
      trialId: trial.id, targetPaidPlanVersionId: paidPlanVersionId, actorPlatformUserId: user.id,
      convertedAt: new Date('2026-03-21T00:00:00.000Z'),
      dispositionsJson: [{ disposition: 'MIGRATE_TO_PAID_EQUIVALENT', paidEquivalentKey: key }],
    });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M15').value).toBe(bundle.addOnAttribution.reduce((s, a) => s + a.count, 0));
  });

  it('REC11: target progress reconciles to won vs unitless monthly target', async () => {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, { email: `tgt-${randomUUID()}@test.local`, roleKeys });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, { status: 'ACTIVE', targetAmount: 2, targetPeriod: 'MONTH', targetCurrency: null });
    const stack = createSalesProductivityStack(prisma);
    const lead = await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, stage: 'WON', createdAt: new Date('2026-02-01T00:00:00.000Z') });
    await createStageHistory(prisma, { leadId: lead.id, toStage: 'WON', actorPlatformUserId: user.id, createdAt: new Date('2026-03-10T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    expect(metricById(bundle, 'M16').value).toBe(0.5);
    expect(claims.sub).toBe(user.id);
  });

  it('REC12: commission snapshot inputs freeze metricsJson matching generation-time compute', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const snap = await stack.snapshots.generate(claims, stack.perms, { representativeId: rep.id, periodKey: PERIOD_KEY }, randomUUID());
    expect((snap.metrics as any).leads_created.value).toBe(1);
    expect(snap.calculationStatus).toBe('UNCONFIGURED');
    expect(snap.computedAmount).toBeNull();
  });
});
