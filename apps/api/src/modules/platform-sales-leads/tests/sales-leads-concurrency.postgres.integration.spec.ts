/**
 * Flexible Step 24 — OCC / concurrency (C* style).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  assertSafePlatformTestDatabaseUrl,
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-leads-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads concurrency (PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    assertSafePlatformTestDatabaseUrl(DEFAULT_PLATFORM_DB_SECURITY_URL);
    prisma = createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    await prisma?.$disconnect();
  });

  beforeEach(async () => {
    clearSalesLeadsFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesLeadTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  async function seed() {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-c-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'OCC Org', contactName: 'Occ' },
      randomUUID(),
    );
    return { claims, stack, lead };
  }

  it('C01: stale expectedRowVersion on update loses', async () => {
    const { claims, stack, lead } = await seed();
    await stack.leads.update(claims, stack.perms, lead.id, {
      organizationName: 'First',
      expectedRowVersion: lead.rowVersion,
    });
    await expect(
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'Stale',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('C02: stale expectedRowVersion on stage loses', async () => {
    const { claims, stack, lead } = await seed();
    await stack.leads.changeStage(claims, stack.perms, lead.id, {
      stage: 'CONTACTED',
      expectedRowVersion: lead.rowVersion,
    });
    await expect(
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'QUALIFIED',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('C03: concurrent updates — exactly one wins', async () => {
    const { claims, stack, lead } = await seed();
    const results = await Promise.allSettled([
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'A',
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.update(claims, stack.perms, lead.id, {
        organizationName: 'B',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled');
    const fail = results.filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(fail).toHaveLength(1);
  });

  it('C04: concurrent stage changes — exactly one wins', async () => {
    const { claims, stack, lead } = await seed();
    const results = await Promise.allSettled([
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'CONTACTED',
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.changeStage(claims, stack.perms, lead.id, {
        stage: 'QUALIFIED',
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('C05: concurrent owner assign — exactly one wins', async () => {
    const { claims, stack, lead } = await seed();
    const u1 = await createPlatformUserFixture(prisma, {
      email: `r1-${randomUUID()}@test.local`,
      roleKeys: ['sales_representative'],
    });
    const u2 = await createPlatformUserFixture(prisma, {
      email: `r2-${randomUUID()}@test.local`,
      roleKeys: ['sales_representative'],
    });
    const r1 = await createRepProfile(prisma, u1.id);
    const r2 = await createRepProfile(prisma, u2.id);
    const results = await Promise.allSettled([
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: r1.id,
        expectedRowVersion: lead.rowVersion,
      }),
      stack.leads.assignOwner(claims, stack.perms, lead.id, {
        ownerRepresentativeId: r2.id,
        expectedRowVersion: lead.rowVersion,
      }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(1);
  });

  it('C06: create idempotency exact replay returns same lead', async () => {
    const { claims, stack } = await seed();
    const key = randomUUID();
    const body = { organizationName: 'Idem Org', contactName: 'Idem' };
    const a = await stack.leads.create(claims, stack.perms, body, key);
    const b = await stack.leads.create(claims, stack.perms, body, key);
    expect(b.id).toBe(a.id);
    expect(await prisma.platformSalesLead.count()).toBe(2); // seed + one created
  });

  it('C07: create idempotency conflict on different payload', async () => {
    const { claims, stack } = await seed();
    const key = randomUUID();
    await stack.leads.create(
      claims,
      stack.perms,
      { organizationName: 'One', contactName: 'A' },
      key,
    );
    await expect(
      stack.leads.create(
        claims,
        stack.perms,
        { organizationName: 'Two', contactName: 'B' },
        key,
      ),
    ).rejects.toMatchObject({ code: 'idempotency_conflict' });
  });

  it('C08: concurrent identical create claims produce single lead', async () => {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-c8-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId);
    const stack = createSalesLeadsStack(prisma);
    const key = randomUUID();
    const body = { organizationName: 'Race Org', contactName: 'Race' };
    const results = await Promise.allSettled([
      stack.leads.create(claims, stack.perms, body, key),
      stack.leads.create(claims, stack.perms, body, key),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled') as Array<
      PromiseFulfilledResult<{ id: string }>
    >;
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    const ids = new Set(fulfilled.map((r) => r.value.id));
    expect(ids.size).toBe(1);
    expect(await prisma.platformSalesLead.count({ where: { organizationName: 'Race Org' } })).toBe(1);
  });

  it('C09: demo OCC conflict', async () => {
    const { claims, stack, lead } = await seed();
    await stack.leads.updateDemo(claims, stack.perms, lead.id, {
      demoStatus: 'SCHEDULED',
      expectedRowVersion: lead.rowVersion,
    });
    await expect(
      stack.leads.updateDemo(claims, stack.perms, lead.id, {
        demoStatus: 'COMPLETED',
        expectedRowVersion: lead.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'conflict' });
  });

  it('C10: rowVersion increments on each successful mutation', async () => {
    const { claims, stack, lead } = await seed();
    let current = lead;
    expect(current.rowVersion).toBe(1);
    current = await stack.leads.update(claims, stack.perms, current.id, {
      contactJobTitle: 'Director',
      expectedRowVersion: current.rowVersion,
    });
    expect(current.rowVersion).toBe(2);
    current = await stack.leads.changeStage(claims, stack.perms, current.id, {
      stage: 'CONTACTED',
      expectedRowVersion: current.rowVersion,
    });
    expect(current.rowVersion).toBe(3);
  });
});
