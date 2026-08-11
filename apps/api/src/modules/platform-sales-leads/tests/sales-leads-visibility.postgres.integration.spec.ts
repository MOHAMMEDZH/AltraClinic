/**
 * Flexible Step 24 — visibility / assignment scope (V01–V12 style).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesLeadsStack } from './sales-leads-stack';
import {
  cleanupSalesLeadTables,
  clearSalesLeadsFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createRepProfile,
  DEFAULT_PLATFORM_DB_SECURITY_URL,
  assertSafePlatformTestDatabaseUrl,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
  SALES_REP_ROLE,
} from './sales-leads-db.harness';
import { SALES_LEAD_PERMISSIONS } from '../platform-sales-leads.constants';
import { SalesLeadNotFoundError } from '../domain/sales-lead.errors';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 24 Sales Leads visibility (PostgreSQL)', () => {
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

  async function actor(roleKeys: string[]) {
    const user = await createPlatformUserFixture(prisma, {
      email: `lead-vis-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id);
    const claims = platformClaims(user.id, session.sessionId, roleKeys);
    return { user, session, claims };
  }

  it('V01: assign permission lists all leads regardless of owner', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repUser = await actor([SALES_REP_ROLE]);
    const rep = await createRepProfile(prisma, repUser.user.id);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      manager.claims,
      stack.perms,
      {
        organizationName: 'Clinic A',
        contactName: 'Alice',
        ownerRepresentativeId: rep.id,
      },
      randomUUID(),
    );
    const list = await stack.leads.list(manager.claims, stack.perms, { page: 1, pageSize: 25 });
    expect(list.total).toBe(1);
    expect(list.items[0].id).toBe(lead.id);
  });

  it('V02: assigned rep sees only owned leads', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    const profileA = await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const mgrStack = createSalesLeadsStack(prisma);
    await mgrStack.leads.create(
      manager.claims,
      mgrStack.perms,
      { organizationName: 'A Org', contactName: 'A', ownerRepresentativeId: profileA.id },
      randomUUID(),
    );
    await mgrStack.leads.create(
      manager.claims,
      mgrStack.perms,
      { organizationName: 'B Org', contactName: 'B', ownerRepresentativeId: profileB.id },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const list = await repStack.leads.list(repA.claims, repStack.perms, { page: 1, pageSize: 25 });
    expect(list.total).toBe(1);
    expect(list.items[0].organizationName).toBe('A Org');
  });

  it('V03: assigned rep cannot detail another rep lead (uniform 404)', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    const profileB = await createRepProfile(prisma, repB.user.id);
    await createRepProfile(prisma, repA.user.id);
    const mgrStack = createSalesLeadsStack(prisma);
    const lead = await mgrStack.leads.create(
      manager.claims,
      mgrStack.perms,
      { organizationName: 'Hidden', contactName: 'X', ownerRepresentativeId: profileB.id },
      randomUUID(),
    );
    const repStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    await expect(repStack.leads.getById(repA.claims, repStack.perms, lead.id)).rejects.toBeInstanceOf(
      SalesLeadNotFoundError,
    );
  });

  it('V04: view without rep profile yields empty list', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const orphan = await actor([SALES_REP_ROLE]);
    const mgrStack = createSalesLeadsStack(prisma);
    await mgrStack.leads.create(
      manager.claims,
      mgrStack.perms,
      { organizationName: 'Orphaned', contactName: 'Y' },
      randomUUID(),
    );
    const orphanStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const list = await orphanStack.leads.list(orphan.claims, orphanStack.perms, {
      page: 1,
      pageSize: 25,
    });
    expect(list.total).toBe(0);
    expect(list.items).toEqual([]);
  });

  it('V05: view without rep profile denies detail (404)', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const orphan = await actor([SALES_REP_ROLE]);
    const mgrStack = createSalesLeadsStack(prisma);
    const lead = await mgrStack.leads.create(
      manager.claims,
      mgrStack.perms,
      { organizationName: 'Hidden2', contactName: 'Z' },
      randomUUID(),
    );
    const orphanStack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view],
    });
    await expect(
      orphanStack.leads.getById(orphan.claims, orphanStack.perms, lead.id),
    ).rejects.toBeInstanceOf(SalesLeadNotFoundError);
  });

  it('V06: create without assign auto-owns to actor rep', async () => {
    const rep = await actor([SALES_REP_ROLE]);
    const profile = await createRepProfile(prisma, rep.user.id);
    const stack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    const lead = await stack.leads.create(
      rep.claims,
      stack.perms,
      { organizationName: 'Mine', contactName: 'Me' },
      randomUUID(),
    );
    expect(lead.ownerRepresentativeId).toBe(profile.id);
  });

  it('V07: create without assign cannot set another owner', async () => {
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const stack = createSalesLeadsStack(prisma, {
      permissions: [SALES_LEAD_PERMISSIONS.view, SALES_LEAD_PERMISSIONS.manage],
    });
    await expect(
      stack.leads.create(
        repA.claims,
        stack.perms,
        {
          organizationName: 'Steal',
          contactName: 'Nope',
          ownerRepresentativeId: profileB.id,
        },
        randomUUID(),
      ),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('V08: assign can reassign ownership across reps', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const repA = await actor([SALES_REP_ROLE]);
    const repB = await actor([SALES_REP_ROLE]);
    const profileA = await createRepProfile(prisma, repA.user.id);
    const profileB = await createRepProfile(prisma, repB.user.id);
    const stack = createSalesLeadsStack(prisma);
    const lead = await stack.leads.create(
      manager.claims,
      stack.perms,
      { organizationName: 'Move', contactName: 'M', ownerRepresentativeId: profileA.id },
      randomUUID(),
    );
    const moved = await stack.leads.assignOwner(manager.claims, stack.perms, lead.id, {
      ownerRepresentativeId: profileB.id,
      expectedRowVersion: lead.rowVersion,
      reason: 'territory split',
    });
    expect(moved.ownerRepresentativeId).toBe(profileB.id);
    const history = await stack.leads.listOwnershipHistory(manager.claims, stack.perms, lead.id);
    expect(history.length).toBeGreaterThanOrEqual(2);
  });

  it('V09: list filter by stage works within scope', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesLeadsStack(prisma);
    const a = await stack.leads.create(
      manager.claims,
      stack.perms,
      { organizationName: 'S1', contactName: 'C1' },
      randomUUID(),
    );
    await stack.leads.create(
      manager.claims,
      stack.perms,
      { organizationName: 'S2', contactName: 'C2' },
      randomUUID(),
    );
    await stack.leads.changeStage(manager.claims, stack.perms, a.id, {
      stage: 'CONTACTED',
      expectedRowVersion: a.rowVersion,
    });
    const list = await stack.leads.list(manager.claims, stack.perms, {
      page: 1,
      pageSize: 25,
      stage: 'CONTACTED',
    });
    expect(list.total).toBe(1);
    expect(list.items[0].organizationName).toBe('S1');
  });

  it('V10: search matches organization and contact', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesLeadsStack(prisma);
    await stack.leads.create(
      manager.claims,
      stack.perms,
      { organizationName: 'Alpha Dental', contactName: 'Sam' },
      randomUUID(),
    );
    await stack.leads.create(
      manager.claims,
      stack.perms,
      { organizationName: 'Beta Clinic', contactName: 'Pat' },
      randomUUID(),
    );
    const byOrg = await stack.leads.list(manager.claims, stack.perms, {
      page: 1,
      pageSize: 25,
      search: 'Alpha',
    });
    expect(byOrg.total).toBe(1);
    const byContact = await stack.leads.list(manager.claims, stack.perms, {
      page: 1,
      pageSize: 25,
      search: 'Pat',
    });
    expect(byContact.total).toBe(1);
  });

  it('V11: pagination is deterministic by createdAt,id desc', async () => {
    const manager = await actor([SALES_MANAGER_ROLE]);
    const stack = createSalesLeadsStack(prisma);
    for (let i = 0; i < 5; i++) {
      await stack.leads.create(
        manager.claims,
        stack.perms,
        { organizationName: `Org ${i}`, contactName: `C${i}` },
        randomUUID(),
      );
    }
    const page1 = await stack.leads.list(manager.claims, stack.perms, { page: 1, pageSize: 2 });
    const page2 = await stack.leads.list(manager.claims, stack.perms, { page: 2, pageSize: 2 });
    expect(page1.items).toHaveLength(2);
    expect(page2.items).toHaveLength(2);
    const ids = [...page1.items, ...page2.items].map((i) => i.id);
    expect(new Set(ids).size).toBe(4);
  });

  it('V12: missing view/manage/assign is forbidden', async () => {
    const user = await actor(['platform_support']);
    const stack = createSalesLeadsStack(prisma, { permissions: [] });
    await expect(
      stack.leads.list(user.claims, stack.perms, { page: 1, pageSize: 25 }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });
});
