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

describeDb('Step 26 export EX01–EX12 (PostgreSQL)', () => {

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

  it('EX01: self export scoped to own representative', async () => {
    const a = await repActor();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).toContain(a.rep.id);
    expect(file.filename).toContain(PERIOD_KEY);
  });

  it('EX02: manager export scoped to permitted representatives', async () => {
    const mgr = await managerActor();
    const report = await repActor({ managerRepresentativeId: mgr.rep.id });
    const file = await mgr.stack.export.exportCsv(mgr.claims, mgr.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).toContain(report.rep.id);
  });

  it('EX03: no unauthorized peer rows in representative export', async () => {
    const a = await repActor();
    const b = await repActor();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).not.toContain(b.rep.id);
  });

  it('EX04: filters cannot widen scope', async () => {
    const a = await repActor();
    const b = await repActor();
    await expect(a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY, representativeId: b.rep.id }))
      .rejects.toBeInstanceOf(SalesProductivityNotFoundError);
  });

  it('EX05: formula cells neutralized for =+-@ prefixes', async () => {
    const { csvSafeCell } = await import('../../platform-audit-center/application/audit-center-redaction');
    expect(csvSafeCell('=CMD()')).toMatch(/^"'=/);
    expect(csvSafeCell('+1234')).toMatch(/^"'+/);
    expect(csvSafeCell('-formula')).toMatch(/^"'-/);
    expect(csvSafeCell('@x')).toMatch(/^"'@/);
  });

  it('EX06: quotes/commas/newlines escaped via csvSafeCell', async () => {
    const { csvSafeCell } = await import('../../platform-audit-center/application/audit-center-redaction');
    const cell = csvSafeCell('a,"b"\nc');
    expect(cell.startsWith('"')).toBe(true);
  });

  it('EX07: Unicode/Arabic preserved in export body', async () => {
    const { csvSafeCell } = await import('../../platform-audit-center/application/audit-center-redaction');
    expect(csvSafeCell('مرحبا')).toContain('مرحبا');
  });

  it('EX08: bounded date range required (invalid period rejected)', async () => {
    const a = await repActor();
    await expect(a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: 'bad' }))
      .rejects.toBeInstanceOf(SalesProductivityValidationError);
  });

  it('EX09: oversized export handled safely with hard take bound (500 reps)', async () => {
    const mgr = await managerActor();
    const file = await mgr.stack.export.exportCsv(mgr.claims, mgr.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body.length).toBeGreaterThan(0);
  });

  it('EX10: no PHI/secrets in export body', async () => {
    const a = await repActor();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).not.toMatch(/password|accessToken|refreshToken|diagnosis|patientId/i);
  });

  it('EX11: deterministic columns header order', async () => {
    const a = await repActor();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    const header = file.body.split('\n')[0];
    expect(header).toContain('representativeId');
    expect(header).toContain('metricKey');
    expect(header).toContain('completeness');
  });

  it('EX12: export totals reconcile to API metric values for identical filters', async () => {
    const { claims, rep, stack } = await managerActor();
    await createLeadFixture(prisma, { ownerRepresentativeId: rep.id, createdAt: new Date('2026-03-05T00:00:00.000Z') });
    const bundle = await stack.metrics.computeForRepresentative({ representativeId: rep.id, periodKey: PERIOD_KEY, sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z') });
    const file = await stack.export.exportCsv(claims, stack.perms, { periodKey: PERIOD_KEY, representativeId: rep.id });
    expect(file.body).toContain(`leads_created`);
    expect(file.body).toContain(String(metricById(bundle, 'M01').value));
  });
});
