/**
 * Flexible Step 23 — representative list deterministic ordering + email search (ORD/EMAIL).
 * SEARCH-A: case-insensitive email `contains` preserved (matches Platform user admin pattern).
 * B-tree unique email index does NOT accelerate ILIKE %needle%; acceptable for Super Admin scale.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createSalesStack } from './sales-representatives-stack';
import {
  cleanupSalesRepresentativeTables,
  clearSalesFailureInjection,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-representatives-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 23 representative list ordering + email search (PostgreSQL)', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = createPlatformDbSecurityClient();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    clearSalesFailureInjection();
    process.env.NODE_ENV = 'test';
    await cleanupSalesRepresentativeTables(prisma);
    await prisma.platformRefreshToken.deleteMany({});
    await prisma.platformUserRole.deleteMany({});
    await prisma.platformUser.deleteMany({});
  });

  async function actor() {
    const user = await createPlatformUserFixture(prisma, {
      email: `sales-ord-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, { stepUpVerifiedAt: new Date() });
    return { claims: platformClaims(user.id, session.sessionId), stack: createSalesStack(prisma) };
  }

  async function createRep(stack: ReturnType<typeof createSalesStack>, claims: ReturnType<typeof platformClaims>, email: string) {
    return stack.reps.create(claims, stack.perms, { email }, `idem-${randomUUID()}`);
  }

  async function forceCreatedAt(id: string, createdAt: Date) {
    await prisma.platformSalesRepresentative.update({ where: { id }, data: { createdAt } });
  }

  it('ORD01 Passed: two representatives with identical createdAt order stably by id DESC', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-01-15T12:00:00.000Z');
    const a = await createRep(stack, claims, `ord01-a-${randomUUID()}@test.local`);
    const b = await createRep(stack, claims, `ord01-b-${randomUUID()}@test.local`);
    await forceCreatedAt(a.id, stamp);
    await forceCreatedAt(b.id, stamp);

    const page = await stack.reps.list({ page: 1, pageSize: 10 });
    expect(page.items).toHaveLength(2);
    const expected = [a.id, b.id].sort().reverse(); // id DESC
    expect(page.items.map((r) => r.id)).toEqual(expected);
  });

  it('ORD02 Passed: first and second page repeats identically across reads', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-02-01T08:00:00.000Z');
    const ids: string[] = [];
    for (let i = 0; i < 5; i++) {
      const rep = await createRep(stack, claims, `ord02-${i}-${randomUUID()}@test.local`);
      await forceCreatedAt(rep.id, stamp);
      ids.push(rep.id);
    }
    const sorted = [...ids].sort().reverse();

    const firstA = await stack.reps.list({ page: 1, pageSize: 2 });
    const firstB = await stack.reps.list({ page: 1, pageSize: 2 });
    const secondA = await stack.reps.list({ page: 2, pageSize: 2 });
    const secondB = await stack.reps.list({ page: 2, pageSize: 2 });

    expect(firstA.items.map((r) => r.id)).toEqual(sorted.slice(0, 2));
    expect(firstB.items.map((r) => r.id)).toEqual(firstA.items.map((r) => r.id));
    expect(secondA.items.map((r) => r.id)).toEqual(sorted.slice(2, 4));
    expect(secondB.items.map((r) => r.id)).toEqual(secondA.items.map((r) => r.id));
  });

  it('ORD03 Passed: inserting a later-created row does not scramble equal-timestamp relative order', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-03-01T10:00:00.000Z');
    const older = await createRep(stack, claims, `ord03-old-${randomUUID()}@test.local`);
    const twinA = await createRep(stack, claims, `ord03-a-${randomUUID()}@test.local`);
    const twinB = await createRep(stack, claims, `ord03-b-${randomUUID()}@test.local`);
    await forceCreatedAt(older.id, new Date('2026-02-01T10:00:00.000Z'));
    await forceCreatedAt(twinA.id, stamp);
    await forceCreatedAt(twinB.id, stamp);
    const twinOrder = [twinA.id, twinB.id].sort().reverse();

    const before = await stack.reps.list({ page: 1, pageSize: 10 });
    expect(before.items.slice(0, 2).map((r) => r.id)).toEqual(twinOrder);

    const newer = await createRep(stack, claims, `ord03-new-${randomUUID()}@test.local`);
    await forceCreatedAt(newer.id, new Date('2026-04-01T10:00:00.000Z'));

    const after = await stack.reps.list({ page: 1, pageSize: 10 });
    expect(after.items[0]?.id).toBe(newer.id);
    expect(after.items.slice(1, 3).map((r) => r.id)).toEqual(twinOrder);
  });

  it('ORD04 Passed: status filter preserves deterministic ordering', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-05-01T12:00:00.000Z');
    const activeA = await createRep(stack, claims, `ord04-a-${randomUUID()}@test.local`);
    const activeB = await createRep(stack, claims, `ord04-b-${randomUUID()}@test.local`);
    const pending = await createRep(stack, claims, `ord04-p-${randomUUID()}@test.local`);
    await stack.reps.activate(claims, stack.perms, activeA.id);
    await stack.reps.activate(claims, stack.perms, activeB.id);
    await forceCreatedAt(activeA.id, stamp);
    await forceCreatedAt(activeB.id, stamp);
    await forceCreatedAt(pending.id, stamp);

    const page = await stack.reps.list({ page: 1, pageSize: 10, status: 'ACTIVE' });
    expect(page.items.every((r) => r.status === 'ACTIVE')).toBe(true);
    expect(page.items.map((r) => r.id)).toEqual([activeA.id, activeB.id].sort().reverse());
    expect(page.items.map((r) => r.id)).not.toContain(pending.id);
  });

  it('ORD05 Passed: equal-timestamp pagination boundary has no duplicates or skips', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-06-01T09:00:00.000Z');
    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const rep = await createRep(stack, claims, `ord05-${i}-${randomUUID()}@test.local`);
      await forceCreatedAt(rep.id, stamp);
      ids.push(rep.id);
    }
    const sorted = [...ids].sort().reverse();
    const p1 = await stack.reps.list({ page: 1, pageSize: 2 });
    const p2 = await stack.reps.list({ page: 2, pageSize: 2 });
    const combined = [...p1.items.map((r) => r.id), ...p2.items.map((r) => r.id)];
    expect(combined).toEqual(sorted);
    expect(new Set(combined).size).toBe(4);
  });

  it('EMAIL01–08 Passed: case-insensitive contains search + status + ordering + page bound', async () => {
    const { claims, stack } = await actor();
    const stamp = new Date('2026-07-01T11:00:00.000Z');
    const needle = `Needle-${randomUUID().slice(0, 8)}`;
    const exact = await createRep(stack, claims, `${needle.toLowerCase()}@exact.example`);
    const prefix = await createRep(stack, claims, `${needle.toLowerCase()}prefix@ex.com`);
    const middle = await createRep(stack, claims, `pre.${needle.toLowerCase()}.mid@ex.com`);
    const mixed = await createRep(stack, claims, `MiXeD.${needle}@ExAmPlE.CoM`);
    const other = await createRep(stack, claims, `other-${randomUUID()}@nomatch.example`);
    for (const id of [exact.id, prefix.id, middle.id, mixed.id, other.id]) {
      await forceCreatedAt(id, stamp);
    }
    await stack.reps.activate(claims, stack.perms, exact.id);
    await stack.reps.activate(claims, stack.perms, middle.id);

    // EMAIL01 exact-ish contains of full local-part path still matches
    const e01 = await stack.reps.list({ page: 1, pageSize: 25, search: `${needle.toLowerCase()}@exact.example` });
    expect(e01.items.map((r) => r.id)).toContain(exact.id);

    // EMAIL02 prefix fragment
    const e02 = await stack.reps.list({ page: 1, pageSize: 25, search: needle.toLowerCase() });
    expect(e02.items.map((r) => r.id).sort()).toEqual(
      [exact.id, prefix.id, middle.id, mixed.id].sort(),
    );

    // EMAIL03 middle substring
    const e03 = await stack.reps.list({ page: 1, pageSize: 25, search: needle.slice(2, 8).toLowerCase() });
    expect(e03.items.length).toBeGreaterThanOrEqual(1);

    // EMAIL04 mixed-case search
    const e04 = await stack.reps.list({ page: 1, pageSize: 25, search: needle.toUpperCase() });
    expect(e04.items.map((r) => r.id).sort()).toEqual(
      [exact.id, prefix.id, middle.id, mixed.id].sort(),
    );

    // EMAIL05 no-match
    const e05 = await stack.reps.list({ page: 1, pageSize: 25, search: `zzz-no-match-${randomUUID()}` });
    expect(e05.items).toHaveLength(0);
    expect(e05.total).toBe(0);

    // EMAIL06 bounded page
    const e06 = await stack.reps.list({ page: 1, pageSize: 2, search: needle.toLowerCase() });
    expect(e06.items.length).toBeLessThanOrEqual(2);
    expect(e06.pageSize).toBe(2);
    expect(e06.total).toBe(4);

    // EMAIL07 search + status
    const e07 = await stack.reps.list({ page: 1, pageSize: 25, search: needle.toLowerCase(), status: 'ACTIVE' });
    expect(e07.items.map((r) => r.id).sort()).toEqual([exact.id, middle.id].sort());
    expect(e07.items.every((r) => r.status === 'ACTIVE')).toBe(true);

    // EMAIL08 search + deterministic ordering (equal createdAt → id DESC among matches)
    const e08 = await stack.reps.list({ page: 1, pageSize: 25, search: needle.toLowerCase() });
    const matchIds = [exact.id, prefix.id, middle.id, mixed.id].sort().reverse();
    expect(e08.items.map((r) => r.id)).toEqual(matchIds);
  });

  it('QUERY01 Passed: role load for a page is a single batched query (not N+1)', async () => {
    const { claims, stack } = await actor();
    for (let i = 0; i < 5; i++) {
      await createRep(stack, claims, `q01-${i}-${randomUUID()}@test.local`);
    }

    let roleFindMany = 0;
    const orig = prisma.platformUserRole.findMany.bind(prisma.platformUserRole);
    prisma.platformUserRole.findMany = (async (...args: unknown[]) => {
      roleFindMany += 1;
      return orig(...(args as Parameters<typeof orig>));
    }) as typeof prisma.platformUserRole.findMany;

    try {
      const page = await stack.reps.list({ page: 1, pageSize: 5 });
      expect(page.items).toHaveLength(5);
      expect(roleFindMany).toBe(1);
    } finally {
      prisma.platformUserRole.findMany = orig;
    }
  });
});
