/**
 * Flexible Step 26 — privacy matrix P01–P12.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesProductivityStack, REP_PRODUCTIVITY_PERMS } from './sales-productivity-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesProductivityTables,
  clearSalesProductivityFailureInjection,
  createLeadFixture,
  createPlanVersionFixture,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  deletePlanVersionFixtures,
  PERIOD_KEY,
  platformClaims,
  platformDbSecurityEnabled,
  resolveCatalogKeys,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
  type TrialCatalogKeys,
} from './sales-productivity-db.harness';
import { SALES_COMMISSION_AUDIT_ACTIONS } from '../platform-sales-productivity.constants';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;
const SECRET_MARKERS = /password|accessToken|refreshToken|secret|4111111111111111/i;
const PATIENT_FIELD_MARKERS = /diagnosis|patientId|clinicalNotes|patientContact|clinicalRecord/i;
const PAYROLL_MARKERS = /payroll|payslip|bankAccount|taxId|iban|routingNumber/i;
const STEP27_MARKERS = /notificationTemplate|templateBody|smsTemplate/i;

describeDb('Step 26 privacy P01–P12 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let keys: TrialCatalogKeys;

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
    await createPlanVersionFixture(prisma, {
      moduleKeys: keys.moduleKeys.slice(0, 2),
      specialtyKeys: keys.specialtyKeys.slice(0, 2),
      trialDefaultEnabled: true,
      trialDefaultDays: 14,
    });
  });

  async function manager() {
    const roleKeys = [SALES_MANAGER_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `p-mgr-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const rep = await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    const stack = createSalesProductivityStack(prisma);
    return { user, claims, rep, stack };
  }

  async function rep() {
    const roleKeys = [SALES_REP_ROLE];
    const user = await createPlatformUserFixture(prisma, {
      email: `p-rep-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    const profile = await createRepProfile(prisma, user.id, { status: 'ACTIVE' });
    const stack = createSalesProductivityStack(prisma, { permissions: REP_PRODUCTIVITY_PERMS });
    return { user, claims, rep: profile, stack };
  }

  it('P01: no patient fields in productivity self payload', async () => {
    const a = await rep();
    const bundle = await a.stack.query.self(a.claims, a.stack.perms, PERIOD_KEY);
    expect(JSON.stringify(bundle)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P02: no clinical data in exports', async () => {
    const a = await rep();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P03: customer drill-down commercial-only — metrics expose counts not clinical customer PHI', async () => {
    const a = await manager();
    const bundle = await a.stack.metrics.computeForRepresentative({
      representativeId: a.rep.id,
      periodKey: PERIOD_KEY,
    });
    expect(JSON.stringify(bundle)).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(bundle.metricsByKey.active_customers).toBeTruthy();
  });

  it('P04: self-view no peer leakage', async () => {
    const a = await rep();
    const b = await rep();
    await createLeadFixture(prisma, {
      ownerRepresentativeId: b.rep.id,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
      organizationName: 'PeerSecretOrg',
    });
    const bundle = await a.stack.query.self(a.claims, a.stack.perms, PERIOD_KEY);
    expect(JSON.stringify(bundle)).not.toContain('PeerSecretOrg');
    expect(bundle.representativeId).toBe(a.rep.id);
  });

  it('P05: manager no unauthorized customer leakage in metrics JSON', async () => {
    const a = await manager();
    const bundle = await a.stack.query.team(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(JSON.stringify(bundle)).not.toMatch(PATIENT_FIELD_MARKERS);
    expect(JSON.stringify(bundle)).not.toMatch(SECRET_MARKERS);
  });

  it('P06: audit no PHI/secrets', async () => {
    const a = await manager();
    const snap = await a.stack.snapshots.generate(
      a.claims,
      a.stack.perms,
      { representativeId: a.rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    const audits = await prisma.auditEntry.findMany({
      where: { action: SALES_COMMISSION_AUDIT_ACTIONS.GENERATED, resourceId: snap.id },
    });
    expect(JSON.stringify(audits)).not.toMatch(SECRET_MARKERS);
    expect(JSON.stringify(audits)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P07: snapshot no secrets/tokens', async () => {
    const a = await manager();
    const snap = await a.stack.snapshots.generate(
      a.claims,
      a.stack.perms,
      { representativeId: a.rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(JSON.stringify(snap)).not.toMatch(SECRET_MARKERS);
  });

  it('P08: export no secrets/tokens', async () => {
    const a = await manager();
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(file.body).not.toMatch(SECRET_MARKERS);
  });

  it('P09: raw notes/free text excluded from productivity metrics payload', async () => {
    const a = await manager();
    const lead = await createLeadFixture(prisma, {
      ownerRepresentativeId: a.rep.id,
      createdAt: new Date('2026-03-05T00:00:00.000Z'),
    });
    await prisma.platformSalesLeadNote.create({
      data: {
        leadId: lead.id,
        body: 'SENSITIVE_FREE_TEXT_NOTE_SHOULD_NOT_APPEAR',
        createdById: a.user.id,
      },
    });
    const bundle = await a.stack.metrics.computeForRepresentative({
      representativeId: a.rep.id,
      periodKey: PERIOD_KEY,
      sourceCutoffAt: new Date('2026-04-15T00:00:00.000Z'),
    });
    expect(JSON.stringify(bundle)).not.toContain('SENSITIVE_FREE_TEXT_NOTE_SHOULD_NOT_APPEAR');
  });

  it('P10: Plan/Add-on attribution commercial identifiers only', async () => {
    const a = await manager();
    const snap = await a.stack.snapshots.generate(
      a.claims,
      a.stack.perms,
      { representativeId: a.rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(Array.isArray(snap.planVersionAttribution)).toBe(true);
    expect(Array.isArray(snap.addOnAttribution)).toBe(true);
    expect(JSON.stringify(snap.planVersionAttribution)).not.toMatch(PATIENT_FIELD_MARKERS);
  });

  it('P11: no payroll/bank/tax data', async () => {
    const a = await manager();
    const snap = await a.stack.snapshots.generate(
      a.claims,
      a.stack.perms,
      { representativeId: a.rep.id, periodKey: PERIOD_KEY },
      randomUUID(),
    );
    expect(JSON.stringify(snap)).not.toMatch(PAYROLL_MARKERS);
    expect(snap.computedAmount).toBeNull();
  });

  it('P12: no Step 27 notification/template data', async () => {
    const a = await manager();
    const bundle = await a.stack.query.self(a.claims, a.stack.perms, PERIOD_KEY);
    const file = await a.stack.export.exportCsv(a.claims, a.stack.perms, { periodKey: PERIOD_KEY });
    expect(JSON.stringify(bundle)).not.toMatch(STEP27_MARKERS);
    expect(file.body).not.toMatch(STEP27_MARKERS);
  });
});
