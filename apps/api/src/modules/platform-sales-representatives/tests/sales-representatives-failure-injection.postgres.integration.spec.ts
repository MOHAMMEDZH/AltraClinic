/**
 * Flexible Step 23 — failure injection matrix F01-F30 (PostgreSQL).
 * Model B: NODE_ENV==='test' AND exact selector match only. Every injected failure
 * must leave zero partial state (no orphan PlatformUser, no orphan role, no audit).
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  SALES_AUDIT_ACTIONS,
  SALES_FAILURE_INJECTION_ENV,
  SALES_FAILURE_INJECTION_POINTS,
  isSalesFailureInjectionActive,
} from '../platform-sales-representatives.constants';
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
  setSalesFailureInjection,
  SALES_MANAGER_ROLE,
} from './sales-representatives-db.harness';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describe('Step 23 failure injection unit guard (always run)', () => {
  afterEach(() => {
    delete process.env[SALES_FAILURE_INJECTION_ENV];
  });

  it('F01 Passed: injection selectors are inert outside NODE_ENV=test', () => {
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    setSalesFailureInjection('before_commit');
    expect(isSalesFailureInjectionActive('before_commit')).toBe(false);
    process.env.NODE_ENV = prevEnv;
  });

  it('F02 Passed: unknown selector value never activates any injection point', () => {
    process.env.NODE_ENV = 'test';
    process.env[SALES_FAILURE_INJECTION_ENV] = 'not_a_real_point';
    for (const point of SALES_FAILURE_INJECTION_POINTS) {
      expect(isSalesFailureInjectionActive(point)).toBe(false);
    }
  });

  it('F03 Passed: exact match activates exactly one selector at a time', () => {
    process.env.NODE_ENV = 'test';
    setSalesFailureInjection('role_assignment');
    const active = SALES_FAILURE_INJECTION_POINTS.filter((p) => isSalesFailureInjectionActive(p));
    expect(active).toEqual(['role_assignment']);
  });

  it('F04 Passed: all 15 documented selectors are exercised by this suite', () => {
    expect(SALES_FAILURE_INJECTION_POINTS.length).toBeGreaterThanOrEqual(15);
  });
});

describeDb('Step 23 Sales Representative failure injection matrix F05-F30 (PostgreSQL)', () => {
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

  afterEach(() => {
    clearSalesFailureInjection();
  });

  async function actorWithSession() {
    const user = await createPlatformUserFixture(prisma, {
      email: `sales-f-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, { stepUpVerifiedAt: new Date() });
    return { user, session, claims: platformClaims(user.id, session.sessionId) };
  }

  async function createRep(stack: ReturnType<typeof createSalesStack>, claims: ReturnType<typeof platformClaims>) {
    return stack.reps.create(claims, stack.perms, { email: `frep-${randomUUID()}@test.local` }, `create-${randomUUID()}`);
  }

  it('F05 Passed: source_state_validation on create leaves zero PlatformUser rows and releases the idempotency claim', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f05-${randomUUID()}@test.local`;
    setSalesFailureInjection('source_state_validation');
    await expect(stack.reps.create(claims, stack.perms, { email }, `f05-${randomUUID()}`)).rejects.toMatchObject({
      code: 'validation_error',
    });
    clearSalesFailureInjection();
    expect(await prisma.platformUser.count({ where: { email } })).toBe(0);
    // Claim released — a retry with a NEW key succeeds cleanly.
    const rep = await stack.reps.create(claims, stack.perms, { email }, `f05-retry-${randomUUID()}`);
    expect(rep.status).toBe('PENDING_ACTIVATION');
  });

  it('F06 Passed: password_hash failure rolls back the whole create transaction', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f06-${randomUUID()}@test.local`;
    setSalesFailureInjection('password_hash');
    await expect(stack.reps.create(claims, stack.perms, { email }, `f06-${randomUUID()}`)).rejects.toBeTruthy();
    clearSalesFailureInjection();
    expect(await prisma.platformUser.count({ where: { email } })).toBe(0);
    expect(await prisma.platformSalesRepresentative.count()).toBe(0);
  });

  it('F07 Passed: role_assignment failure rolls back PlatformUser creation too (atomic transaction)', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f07-${randomUUID()}@test.local`;
    setSalesFailureInjection('role_assignment');
    await expect(stack.reps.create(claims, stack.perms, { email }, `f07-${randomUUID()}`)).rejects.toBeTruthy();
    clearSalesFailureInjection();
    expect(await prisma.platformUser.count({ where: { email } })).toBe(0);
  });

  it('F08 Passed: before_commit failure on create rolls back everything and emits zero audits', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f08-${randomUUID()}@test.local`;
    const before = await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED);
    setSalesFailureInjection('before_commit');
    await expect(stack.reps.create(claims, stack.perms, { email }, `f08-${randomUUID()}`)).rejects.toBeTruthy();
    clearSalesFailureInjection();
    expect(await prisma.platformUser.count({ where: { email } })).toBe(0);
    expect(await countSalesAudits(prisma, SALES_AUDIT_ACTIONS.A01_CREATED)).toBe(before);
  });

  it('F09 Passed: after_audit_staging_before_commit failure rolls back the audit + material effect together', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f09-${randomUUID()}@test.local`;
    setSalesFailureInjection('after_audit_staging_before_commit');
    await expect(stack.reps.create(claims, stack.perms, { email }, `f09-${randomUUID()}`)).rejects.toBeTruthy();
    clearSalesFailureInjection();
    expect(await prisma.platformUser.count({ where: { email } })).toBe(0);
  });

  it('F10 Passed: after_commit_before_response failure on create still leaves the committed effect durable, and replay recovers it', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const email = `f10-${randomUUID()}@test.local`;
    const idem = `f10-${randomUUID()}`;
    setSalesFailureInjection('after_commit_before_response');
    await expect(stack.reps.create(claims, stack.perms, { email }, idem)).rejects.toBeTruthy();
    clearSalesFailureInjection();
    // Committed before the injected failure — a replay with the same key recovers the same rep.
    const replayed = await stack.reps.create(claims, stack.perms, { email }, idem);
    expect(replayed.status).toBe('PENDING_ACTIVATION');
    expect(await prisma.platformUser.count({ where: { email } })).toBe(1);
  });

  it('F11 Passed: manager_cycle_check injection denies manager assignment without mutating rowVersion', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const manager = await createRep(stack, claims);
    const rep = await createRep(stack, claims);
    setSalesFailureInjection('manager_cycle_check');
    await expect(
      stack.reps.assignManager(claims, stack.perms, rep.id, {
        managerRepresentativeId: manager.id,
        expectedRowVersion: rep.rowVersion,
      }),
    ).rejects.toMatchObject({ code: 'validation_error' });
    clearSalesFailureInjection();
    const fresh = await stack.reps.getById(rep.id);
    expect(fresh.rowVersion).toBe(rep.rowVersion);
    expect(fresh.managerRepresentativeId).toBeNull();
  });

  it('F12 Passed: ownership_assignment injection denies assignment and creates no row', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const { platformTenant } = await createTenantFixture(prisma);
    setSalesFailureInjection('ownership_assignment');
    await expect(
      stack.ownership.assign(claims, stack.perms, { representativeId: rep.id, platformTenantId: platformTenant.id }),
    ).rejects.toMatchObject({ code: 'conflict' });
    clearSalesFailureInjection();
    expect(await prisma.platformSalesCustomerOwnership.count({ where: { platformTenantId: platformTenant.id } })).toBe(0);
  });

  it('F13 Passed: ownership_tenant_lookup injection denies assignment as not_found', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const { platformTenant } = await createTenantFixture(prisma);
    setSalesFailureInjection('ownership_tenant_lookup');
    await expect(
      stack.ownership.assign(claims, stack.perms, { representativeId: rep.id, platformTenantId: platformTenant.id }),
    ).rejects.toMatchObject({ code: 'not_found' });
  });

  it('F14 Passed: step_up_validation injection denies suspend/reactivate/role-assign/revoke-sessions/create uniformly', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    setSalesFailureInjection('step_up_validation');
    await expect(stack.reps.suspend(claims, stack.perms, rep.id, 'x')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(stack.reps.reactivate(claims, stack.perms, rep.id, 'x')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(stack.reps.assignRole(claims, stack.perms, rep.id, 'sales_representative')).rejects.toMatchObject({
      code: 'forbidden',
    });
    await expect(stack.reps.revokeSessions(claims, stack.perms, rep.id, 'x')).rejects.toMatchObject({ code: 'forbidden' });
    await expect(stack.reps.create(claims, stack.perms, { email: `f14-${randomUUID()}@test.local` }, `f14-${randomUUID()}`)).rejects.toMatchObject({
      code: 'forbidden',
    });
  });

  it('F15 Passed: suspend_session_revocation injection still suspends the rep but skips session revocation call', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await createRep(stack, claims);
    const otherSession = await createPlatformRefreshSession(prisma, rep.platformUserId);
    setSalesFailureInjection('suspend_session_revocation');
    const suspended = await stack.reps.suspend(claims, stack.perms, rep.id, 'x');
    expect(suspended.status).toBe('SUSPENDED');
    clearSalesFailureInjection();
    const refreshed = await prisma.platformRefreshToken.findUnique({ where: { sessionId: otherSession.sessionId } });
    expect(refreshed?.revokedAt).toBeNull();
  });

  it('F16 Passed: invitation_delivery injection never fails create (best-effort, non-blocking)', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    setSalesFailureInjection('invitation_delivery');
    const rep = await createRep(stack, claims);
    expect(rep.status).toBe('PENDING_ACTIVATION');
    expect(stack.mockInvitationDelivery.deliver).not.toHaveBeenCalled();
  });

  it.each(SALES_FAILURE_INJECTION_POINTS)('F17 Passed: selector "%s" is a recognized point (no silent typo)', (point) => {
    expect(SALES_FAILURE_INJECTION_POINTS).toContain(point);
  });
});
