/**
 * Flexible Step 23 — Model A audit cardinality matrix A01-A16 (PostgreSQL).
 * Every successful mutation emits exactly one audit row; failures/replays emit zero.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { SALES_AUDIT_ACTIONS } from '../platform-sales-representatives.constants';
import { createSalesStack } from './sales-representatives-stack';
import {
  cleanupSalesRepresentativeTables,
  clearSalesFailureInjection,
  countSalesAudits,
  createPlatformDbSecurityClient,
  createPlatformRefreshSession,
  createPlatformUserFixture,
  createTenantFixture,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-representatives-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 23 Sales Representative audit matrix A01-A16 (PostgreSQL)', () => {
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

  async function actorWithSession(stepUpFresh = true) {
    const user = await createPlatformUserFixture(prisma, {
      email: `sales-a-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, {
      stepUpVerifiedAt: stepUpFresh ? new Date() : new Date(Date.now() - 60 * 60_000),
    });
    return { user, session, claims: platformClaims(user.id, session.sessionId) };
  }

  async function createRep(stack: ReturnType<typeof createSalesStack>, claims: ReturnType<typeof platformClaims>) {
    return stack.reps.create(
      claims,
      stack.perms,
      { email: `rep-${randomUUID()}@test.local`, reason: 'fixture' },
      `create-${randomUUID()}`,
    );
  }

  it('A01 Passed: create emits exactly one audit row', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    const rep = await createRep(stack, claims);
    const after = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    expect(after - before).toBe(1);
    expect(rep.status).toBe('PENDING_ACTIVATION');
  });

  it('A02 Passed: combined profile update emits exactly one profile_updated audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A02_PROFILE_UPDATED);
    await stack.reps.updateProfile(claims, stack.perms, rep.id, {
      regionCode: 'ME-01',
      territoryCode: 'T-01',
      displayName: 'New Name',
      expectedRowVersion: rep.rowVersion,
    });
    const after = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A02_PROFILE_UPDATED);
    expect(after - before).toBe(1);
  });

  it('A03 Passed: region-only update emits region_updated (not generic profile_updated)', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const beforeRegion = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A03_REGION_UPDATED);
    const beforeProfile = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A02_PROFILE_UPDATED);
    await stack.reps.updateProfile(claims, stack.perms, rep.id, {
      regionCode: 'ME-02',
      expectedRowVersion: rep.rowVersion,
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A03_REGION_UPDATED)) - beforeRegion).toBe(1);
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A02_PROFILE_UPDATED)) - beforeProfile).toBe(0);
  });

  it('A04 Passed: territory-only update emits territory_updated', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A04_TERRITORY_UPDATED);
    await stack.reps.updateProfile(claims, stack.perms, rep.id, {
      territoryCode: 'T-99',
      expectedRowVersion: rep.rowVersion,
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A04_TERRITORY_UPDATED)) - before).toBe(1);
  });

  it('A05/A06 Passed: first manager assign emits manager_assigned; reassign emits manager_reassigned', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const manager1 = await createRep(stack, claims);
    const manager2 = await createRep(stack, claims);
    const rep = await createRep(stack, claims);

    const beforeAssign = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A05_MANAGER_ASSIGNED);
    const assigned = await stack.reps.assignManager(claims, stack.perms, rep.id, {
      managerRepresentativeId: manager1.id,
      expectedRowVersion: rep.rowVersion,
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A05_MANAGER_ASSIGNED)) - beforeAssign).toBe(1);

    const beforeReassign = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A06_MANAGER_REASSIGNED);
    await stack.reps.assignManager(claims, stack.perms, rep.id, {
      managerRepresentativeId: manager2.id,
      expectedRowVersion: assigned.rowVersion,
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A06_MANAGER_REASSIGNED)) - beforeReassign).toBe(1);
  });

  it('A07 Passed: target update emits exactly one target_updated audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A07_TARGET_UPDATED);
    await stack.reps.updateTarget(claims, stack.perms, rep.id, {
      targetAmount: 15000,
      targetCurrency: 'USD',
      targetPeriod: 'QUARTER',
      expectedRowVersion: rep.rowVersion,
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A07_TARGET_UPDATED)) - before).toBe(1);
  });

  it('A08/A09 Passed: role assign then remove each emit exactly one audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const beforeAssign = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A08_ROLE_ASSIGNED);
    await stack.reps.assignRole(claims, stack.perms, rep.id, 'sales_representative', 'confirm role');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A08_ROLE_ASSIGNED)) - beforeAssign).toBe(1);

    const beforeRemove = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A09_ROLE_REMOVED);
    await stack.reps.removeRole(claims, stack.perms, rep.id, 'sales_representative', 'cleanup');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A09_ROLE_REMOVED)) - beforeRemove).toBe(1);
  });

  it('A10/A11/A12 Passed: activate, suspend, reactivate each emit exactly one audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);

    const beforeActivate = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A10_ACTIVATED);
    await stack.reps.activate(claims, stack.perms, rep.id, 'go-live');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A10_ACTIVATED)) - beforeActivate).toBe(1);

    const beforeSuspend = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A11_SUSPENDED);
    await stack.reps.suspend(claims, stack.perms, rep.id, 'policy violation');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A11_SUSPENDED)) - beforeSuspend).toBe(1);

    const beforeReactivate = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A12_REACTIVATED);
    await stack.reps.reactivate(claims, stack.perms, rep.id, 'cleared');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A12_REACTIVATED)) - beforeReactivate).toBe(1);
  });

  it('A13 Passed: revoke sessions emits exactly one audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A13_SESSIONS_REVOKED);
    await stack.reps.revokeSessions(claims, stack.perms, rep.id, 'security incident');
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A13_SESSIONS_REVOKED)) - before).toBe(1);
  });

  it('A14/A15/A16 Passed: ownership assign, reassign, remove each emit exactly one audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep1 = await createRep(stack, claims);
    const rep2 = await createRep(stack, claims);
    const { platformTenant } = await createTenantFixture(prisma);

    const beforeAssign = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A14_OWNERSHIP_ASSIGNED);
    const assigned = await stack.ownership.assign(claims, stack.perms, {
      representativeId: rep1.id,
      platformTenantId: platformTenant.id,
      reason: 'new customer',
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A14_OWNERSHIP_ASSIGNED)) - beforeAssign).toBe(1);

    const beforeReassign = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A15_OWNERSHIP_REASSIGNED);
    const reassigned = await stack.ownership.reassign(claims, stack.perms, platformTenant.id, {
      representativeId: rep2.id,
      expectedRowVersion: assigned.rowVersion,
      reason: 'territory change',
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A15_OWNERSHIP_REASSIGNED)) - beforeReassign).toBe(1);

    const beforeRemove = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A16_OWNERSHIP_REMOVED);
    await stack.ownership.remove(claims, stack.perms, platformTenant.id, {
      expectedRowVersion: reassigned.rowVersion,
      reason: 'customer churned',
    });
    expect((await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A16_OWNERSHIP_REMOVED)) - beforeRemove).toBe(1);
  });

  it('No invented audits: a failed create (conflict) emits zero A01 audits', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `dup-${randomUUID()}@test.local`;
    await stack.reps.create(claims, stack.perms, { email }, `first-${randomUUID()}`);
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    await expect(
      stack.reps.create(claims, stack.perms, { email }, `second-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'conflict' });
    const after = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    expect(after - before).toBe(0);
  });

  it('No invented audits: idempotent replay of create does not double-audit', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const idem = `replay-${randomUUID()}`;
    const email = `r1-${randomUUID()}@test.local`;
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    const first = await stack.reps.create(claims, stack.perms, { email }, idem);
    const second = await stack.reps.create(claims, stack.perms, { email }, idem);
    expect(second.id).toBe(first.id);
    const after = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    expect(after - before).toBe(1);
  });
});
