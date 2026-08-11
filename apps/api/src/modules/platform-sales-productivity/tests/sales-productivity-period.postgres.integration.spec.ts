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
import { utcMonthPeriod, isTimestampInPeriod } from '../domain/period.util';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 26 period semantics T01–T12 (PostgreSQL)', () => {

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
    trialPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
        trialDefaultEnabled: true,
        trialDefaultDays: 14,
      })
    ).planVersionId;
    paidPlanVersionId = (
      await createPlanVersionFixture(prisma, {
        paid: true,
        moduleKeys: keys.moduleKeys.slice(0, 2),
        specialtyKeys: keys.specialtyKeys.slice(0, 2),
      })
    ).planVersionId;
  });

  afterEach(() => clearSalesProductivityFailureInjection());

  async function managerActor() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `mgr-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    const stack = createSalesProductivityStack(prisma);
    return { user, session, claims, rep, stack };
  }

  async function repActor(opts: { managerRepresentativeId?: string | null; status?: 'ACTIVE' | 'SUSPENDED' } = {}) {
    const roleKeys = [SALES_REP_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `rep-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, {
      status: opts.status ?? 'ACTIVE',
      managerRepresentativeId: opts.managerRepresentativeId ?? null,
    });
    const stack = createSalesProductivityStack(prisma, { permissions: REP_PRODUCTIVITY_PERMS });
    return { user, session, claims, rep, stack };
  }


  it('T01: month start included in metric event bound', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-01T00:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M01').value).toBe(1);
    expect(bundle.periodStart).toBe('2026-03-01T00:00:00.000Z');
  });

  it('T02: last instant before next month included', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-31T23:59:59.999Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M01').value).toBe(1);
  });

  it('T03: exact next-month boundary excluded', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M01').value).toBe(0);
  });

  it('T04: leap-year February period bounds accepted', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2024-02-29T12:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: '2024-02',
      sourceCutoffAt: new Date('2024-03-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M01').value).toBe(1);
    expect(bundle.periodEnd).toBe('2024-03-01T00:00:00.000Z');
  });

  it('T05: DST month still uses UTC calendar bounds', async () => {
    const p = utcMonthPeriod('2026-03');
    expect(p.periodTimezone).toBe('UTC');
    expect(isTimestampInPeriod(new Date('2026-03-08T02:30:00.000Z'), p)).toBe(true);
  });

  it('T06: reporting timezone stored as UTC on every query bundle', async () => {
    const { rep, stack } = await managerActor();
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
    });
    expect(bundle.periodTimezone).toBe('UTC');
  });

  it('T07: UTC/local boundary uses UTC exclusive end', async () => {
    const p = utcMonthPeriod('2026-03');
    expect(isTimestampInPeriod(new Date('2026-03-31T23:59:59.999Z'), p)).toBe(true);
    expect(isTimestampInPeriod(new Date('2026-04-01T00:00:00.000Z'), p)).toBe(false);
  });

  it('T08: late-arriving source row included when timestamp in bound at sourceCutoffAt', async () => {
    const { rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-20T00:00:00.000Z'),
    });
    const early = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-03-10T00:00:00.000Z'),
    });
    expect(metricById(early, 'M01').value).toBe(0);
    const late = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-03-25T00:00:00.000Z'),
    });
    expect(metricById(late, 'M01').value).toBe(1);
  });

  it('T09: corrected source row reflected on live compute but not on finalized snapshot', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-12T00:00:00.000Z'),
    });
    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY, finalize: true },
      randomUUID(),
    );
    expect((snap.metrics as any).leads_created.value).toBe(1);
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-13T00:00:00.000Z'),
    });
    const live = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(live, 'M01').value).toBe(2);
    const reloaded = await stack.snapshots.getById(claims, stack.perms, snap.id);
    expect((reloaded.metrics as any).leads_created.value).toBe(1);
  });

  it('T10: cancellation boundary uses cancelledAt exclusive end', async () => {
    const { user, rep, stack } = await managerActor();
    const { platformTenant } = await createTenantFixture(prisma, { provisionedBy: user.id });
    await createOwnership(prisma, rep.id, platformTenant.id, user.id);
    await createCommercialConfigFixture(prisma, {
      platformTenantId: platformTenant.id,
      createdByPlatformUserId: user.id,
      planVersionId: paidPlanVersionId,
      lifecycle: 'CANCELLED',
      cancelledAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M13').value).toBe(0);
  });

  it('T11: conversion boundary uses convertedAt exclusive end', async () => {
    const { user, rep, stack } = await managerActor();
    const trial = await createTrialFixture(prisma, {
      ownerRepresentativeId: rep.id,
      trialPlanVersionId,
      createdByPlatformUserId: user.id,
      status: 'CONVERTED',
    });
    await createConversionFixture(prisma, {
      trialId: trial.id,
      targetPaidPlanVersionId: paidPlanVersionId,
      actorPlatformUserId: user.id,
      convertedAt: new Date('2026-04-01T00:00:00.000Z'),
    });
    const bundle = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(metricById(bundle, 'M08').value).toBe(0);
  });

  it('T12: repeated month generation is deterministic for identical source cutoff window', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: rep.id,
      createdAt: new Date('2026-03-08T00:00:00.000Z'),
    });
    const a = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-03-31T23:59:59.000Z'),
    });
    const b = await stack.metrics.computeForRepresentative({
      representativeId: rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-03-31T23:59:59.000Z'),
    });
    expect(a.metrics.map((m) => [m.id, m.value, m.completeness])).toEqual(
      b.metrics.map((m) => [m.id, m.value, m.completeness]),
    );
    const snap = await stack.snapshots.generate(
      claims,
      stack.perms,
      { representativeId: rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(snap.calculationStatus).toBe('UNCONFIGURED');
    expect(snap.formulaVersion).toBe(COMMISSION_FORMULA_VERSION);
  });
});
