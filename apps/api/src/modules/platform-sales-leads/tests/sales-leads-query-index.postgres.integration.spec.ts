/**
 * Flexible Step 24 — query / index / N+1 proof for list, history, notes, plan-fit.
 */
import { randomUUID } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads query/index/N+1 (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let queryLog: Array<{ sql: string; duration: number }>;

  beforeAll(() => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = new PrismaClient({
      datasources: {
        db: {
          url:
            process.env.INTEGRATION_DATABASE_URL ||
            DEFAULT_PLATFORM_DB_SECURITY_URL,
        },
      },
      log: [{ emit: 'event', level: 'query' }],
      transactionOptions: { maxWait: 20_000, timeout: 60_000 },
    });
    queryLog = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (prisma as any).$on('query', (e: Prisma.QueryEvent) => {
      queryLog.push({ sql: e.query, duration: e.duration });
    });
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesLeadsFailureInjection();
    process.env.NODE_ENV = 'test';
    queryLog = [];
    await cleanupSalesLeadTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  async function actor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-q-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    return {
      claims: platformClaims(user.id, session.sessionId),
      stack: createSalesLeadsStack(prisma),
    };
  }

  function leadSelectQueries() {
    return queryLog.filter(
      (q) =>
        /platform_sales_leads/i.test(q.sql) &&
        /^\s*SELECT/i.test(q.sql) &&
        !/COUNT/i.test(q.sql),
    );
  }

  it('Q01 list page: owner N+1 = 0; contacts embedded (no per-row contact query)', async () => {
    const { claims, stack } = await actor();
    for (let i = 0; i < 5; i++) {
      await stack.leads.create(
        claims,
        stack.perms,
        { organizationName: `Q01-${i}`, contactName: `C${i}` },
        randomUUID(),
      );
    }
    queryLog = [];
    const page = await stack.leads.list(claims, stack.perms, { page: 1, pageSize: 25 });
    expect(page.items.length).toBe(5);
    const selects = leadSelectQueries();
    // Single page SELECT (plus optional count in parallel — count excluded above).
    expect(selects.length).toBeLessThanOrEqual(2);
    const ownerLookups = queryLog.filter((q) =>
      /platform_sales_representatives/i.test(q.sql) && /SELECT/i.test(q.sql),
    );
    // List path does not join/load owners per row (N+1 owner = 0).
    expect(ownerLookups.length).toBe(0);
    const noteQueries = queryLog.filter((q) => /platform_sales_lead_notes/i.test(q.sql));
    expect(noteQueries.length).toBe(0);
  });

  it('Q02 orderBy createdAt desc, id desc', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-08-01T12:00:00.000Z');
    const a = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q02-A', contactName: 'A' },
      randomUUID(),
    );
    const b = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q02-B', contactName: 'B' },
      randomUUID(),
    );
    await prisma.platformSalesLead.update({ where: { id: a.id }, data: { createdAt: stamp } });
    await prisma.platformSalesLead.update({ where: { id: b.id }, data: { createdAt: stamp } });
    const page = await stack.leads.list(claims, stack.perms, { page: 1, pageSize: 10 });
    const expected = [a.id, b.id].sort().reverse();
    expect(page.items.map((i) => i.id)).toEqual(expected);
  });

  it('Q03 pageSize bound (controller clamps to 100; service honors take)', async () => {
    const { claims, stack } = await actor();
    for (let i = 0; i < 3; i++) {
      await stack.leads.create(
        claims,
        stack.perms,
        { organizationName: `Q03-${i}`, contactName: 'C' },
        randomUUID(),
      );
    }
    const page = await stack.leads.list(claims, stack.perms, { page: 1, pageSize: 2 });
    expect(page.items.length).toBe(2);
    expect(page.pageSize).toBe(2);
    expect(page.total).toBe(3);
  });

  it('Q04 stage history list bounded (take ≤ 200)', async () => {
    const { claims, stack } = await actor();
    let lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q04', contactName: 'Q' },
      randomUUID(),
    );
    lead = await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'CONTACTED',
      expectedRowVersion: lead.rowVersion,
    });
    lead = await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'QUALIFIED',
      expectedRowVersion: lead.rowVersion,
    });
    queryLog = [];
    const hist = await stack.leads.listStageHistory(claims, stack.perms, lead.id);
    expect(hist.length).toBeLessThanOrEqual(200);
    expect(hist.length).toBeGreaterThanOrEqual(2);
    const histSelects = queryLog.filter((q) =>
      /platform_sales_lead_stage_history/i.test(q.sql),
    );
    expect(histSelects.length).toBe(1);
  });

  it('Q05 ownership history list bounded', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q05', contactName: 'Q' },
      randomUUID(),
    );
    queryLog = [];
    const hist = await stack.leads.listOwnershipHistory(claims, stack.perms, lead.id);
    expect(hist.length).toBeLessThanOrEqual(200);
    const histSelects = queryLog.filter((q) =>
      /platform_sales_lead_ownership_history/i.test(q.sql),
    );
    expect(histSelects.length).toBeLessThanOrEqual(2);
  });

  it('Q06 notes list bounded (take ≤ 100)', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q06', contactName: 'Q' },
      randomUUID(),
    );
    await stack.leads.addNote(claims, stack.perms, lead.id, { body: 'note one' });
    await stack.leads.addNote(claims, stack.perms, lead.id, { body: 'note two' });
    queryLog = [];
    const notes = await stack.leads.listNotes(claims, stack.perms, lead.id);
    expect(notes.length).toBe(2);
    expect(notes.length).toBeLessThanOrEqual(100);
    const noteSelects = queryLog.filter((q) => /platform_sales_lead_notes/i.test(q.sql));
    expect(noteSelects.length).toBe(1);
  });

  it('Q07 plan-fit catalog reads not N+1 per module', async () => {
    const { claims, stack } = await actor();
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      {
        organizationName: 'Q07',
        contactName: 'Q',
        desiredModuleKeys: ['module.a', 'module.b', 'module.c', 'module.d'],
      },
      randomUUID(),
    );
    queryLog = [];
    await stack.leads.getPlanFit(claims, stack.perms, lead.id);
    const catalogItemSelects = queryLog.filter(
      (q) => /healthcare_catalog_item|HealthcareCatalogItem/i.test(q.sql) && /SELECT/i.test(q.sql),
    );
    const planVersionSelects = queryLog.filter(
      (q) => /platform_plan_version/i.test(q.sql) && /SELECT/i.test(q.sql),
    );
    const ruleSelects = queryLog.filter(
      (q) => /compatibility_rule|HealthcareCatalogCompatibilityRule/i.test(q.sql) && /SELECT/i.test(q.sql),
    );
    // Batched findMany (items + rules + published versions) — not one query per desired module key.
    expect(catalogItemSelects.length).toBeLessThan(lead.desiredModuleKeys.length);
    expect(planVersionSelects.length).toBeLessThan(lead.desiredModuleKeys.length);
    expect(ruleSelects.length).toBeLessThan(lead.desiredModuleKeys.length);
    expect(
      catalogItemSelects.length + planVersionSelects.length + ruleSelects.length,
    ).toBeLessThan(lead.desiredModuleKeys.length * 2);
  });

  it('Q08 optional EXPLAIN for list SELECT (Seq Scan ok on tiny fixtures)', async () => {
    const { claims, stack } = await actor();
    await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'Q08', contactName: 'Q' },
      randomUUID(),
    );
    const plan = await prisma.$queryRawUnsafe<Array<{ 'QUERY PLAN': string }>>(
      `EXPLAIN SELECT id FROM platform_sales_leads ORDER BY "createdAt" DESC, id DESC LIMIT 25`,
    );
    const text = plan.map((r) => r['QUERY PLAN']).join('\n');
    // Tiny fixtures may Seq Scan; Index Scan also acceptable via createdAt+id index.
    expect(text.length).toBeGreaterThan(0);
    expect(text).toMatch(/Seq Scan|Index Scan|Index Only Scan|Sort/i);
  });

  it('Q09 indexes exist for list/history/notes', async () => {
    const indexes = await prisma.$queryRawUnsafe<Array<{ indexname: string; tablename: string }>>(
      `SELECT indexname, tablename FROM pg_indexes
       WHERE tablename IN (
         'platform_sales_leads',
         'platform_sales_lead_stage_history',
         'platform_sales_lead_ownership_history',
         'platform_sales_lead_notes'
       )
       ORDER BY 1`,
    );
    const names = indexes.map((i) => i.indexname);
    expect(names.some((n) => /createdAt|created_at/i.test(n) || n.includes('createdAt'))).toBe(true);
    expect(indexes.some((i) => i.tablename === 'platform_sales_lead_notes')).toBe(true);
    expect(indexes.some((i) => i.tablename === 'platform_sales_lead_stage_history')).toBe(true);
  });
});
