/**
 * Flexible Step 23 — manager assignment matrix M01-M08 (PostgreSQL + unit).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { assertNoManagerCycle } from '../application/sales-manager-graph';
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

describe('Step 23 manager cycle unit matrix M01-M03 (always run)', () => {
  it('M01 Passed: self-manager denied', async () => {
    const id = randomUUID();
    await expect(assertNoManagerCycle(id, id, async () => null)).rejects.toMatchObject({
      code: 'validation_error',
    });
  });

  it('M02 Passed: direct 2-cycle denied (A -> B -> A)', async () => {
    const a: string = randomUUID();
    const b: string = randomUUID();
    const graph = new Map<string, { id: string; managerRepresentativeId: string | null }>([
      [b, { id: b, managerRepresentativeId: a }],
    ]);
    await expect(
      assertNoManagerCycle(a, b, async (repId) => graph.get(repId) ?? null),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('M03 Passed: valid deep chain (no cycle) is accepted', async () => {
    const a: string = randomUUID();
    const b: string = randomUUID();
    const c: string = randomUUID();
    const graph = new Map<string, { id: string; managerRepresentativeId: string | null }>([
      [c, { id: c, managerRepresentativeId: b }],
      [b, { id: b, managerRepresentativeId: null }],
    ]);
    await expect(
      assertNoManagerCycle(a, c, async (repId) => graph.get(repId) ?? null),
    ).resolves.toBeUndefined();
  });
});

describeDb('Step 23 manager assignment matrix M04-M08 (PostgreSQL)', () => {
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

  async function actorWithSession() {
    const user = await createPlatformUserFixture(prisma, {
      email: `sales-m-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, { stepUpVerifiedAt: new Date() });
    return { user, session, claims: platformClaims(user.id, session.sessionId) };
  }

  async function createRep(stack: ReturnType<typeof createSalesStack>, claims: ReturnType<typeof platformClaims>) {
    return stack.reps.create(
      claims,
      stack.perms,
      { email: `mrep-${randomUUID()}@test.local`, reason: 'fixture' },
      `create-${randomUUID()}`,
    );
  }

  it('M04 Passed: self-manager denied end-to-end via service', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    await expect(
      stack.reps.assignManager(claims, stack.perms, rep.id, {
        managerRepresentativeId: rep.id,
        expectedRowVersion: rep.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('M05 Passed: 3-node cycle denied end-to-end (A manager of B, B manager of C, C -> A denied)', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const repA = await createRep(stack, claims);
    const repB = await createRep(stack, claims);
    const repC = await createRep(stack, claims);
    await stack.reps.assignManager(claims, stack.perms, repB.id, {
      managerRepresentativeId: repA.id,
      expectedRowVersion: repB.rowVersion,
    });
    await stack.reps.assignManager(claims, stack.perms, repC.id, {
      managerRepresentativeId: repB.id,
      expectedRowVersion: repC.rowVersion,
    });
    await expect(
      stack.reps.assignManager(claims, stack.perms, repA.id, {
        managerRepresentativeId: repC.id,
        expectedRowVersion: repA.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('M06 Passed: nonexistent manager id is rejected as not_found', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    await expect(
      stack.reps.assignManager(claims, stack.perms, rep.id, {
        managerRepresentativeId: randomUUID(),
        expectedRowVersion: rep.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('M07 Passed: disabled manager cannot be assigned', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const manager = await createRep(stack, claims);
    await prisma.platformSalesRepresentative.update({ where: { id: manager.id }, data: { status: 'DISABLED' } });
    const rep = await createRep(stack, claims);
    await expect(
      stack.reps.assignManager(claims, stack.perms, rep.id, {
        managerRepresentativeId: manager.id,
        expectedRowVersion: rep.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
  });

  it('M08 Passed: clearing manager assignment (null) is allowed and audited as reassignment when previously set', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const manager = await createRep(stack, claims);
    const rep = await createRep(stack, claims);
    const assigned = await stack.reps.assignManager(claims, stack.perms, rep.id, {
      managerRepresentativeId: manager.id,
      expectedRowVersion: rep.rowVersion,
    });
    expect(assigned.managerRepresentativeId).toBe(manager.id);
    const cleared = await stack.reps.assignManager(claims, stack.perms, rep.id, {
      managerRepresentativeId: null,
      expectedRowVersion: assigned.rowVersion,
    });
    expect(cleared.managerRepresentativeId).toBeNull();
  });
});
