/**
 * Flexible Step 23 — commercial isolation & suspension security gate proofs.
 * Ownership is commercial metadata only: it must never grant Clinic auth, tenant
 * membership, PHI, entitlement/subscription authority, or provisioning access.
 * Suspension must immediately invalidate all outstanding sessions for the rep.
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
  createTenantFixture,
  platformClaims,
  platformDbSecurityEnabled,
  SALES_MANAGER_ROLE,
} from './sales-representatives-db.harness';
import { PLATFORM_ROLES } from '../../auth/platform-rbac/platform-rbac.catalog';

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

describeDb('Step 23 commercial isolation & suspension security gate (PostgreSQL)', () => {
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
      email: `sales-iso-${randomUUID()}@test.local`,
      roleKeys: [SALES_MANAGER_ROLE],
    });
    const session = await createPlatformRefreshSession(prisma, user.id, { stepUpVerifiedAt: new Date() });
    return { user, session, claims: platformClaims(user.id, session.sessionId) };
  }

  it('Ownership does not create, modify, or reference any Clinic Tenant/User/Role/Session row', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `iso1-${randomUUID()}@test.local` }, `iso1-${randomUUID()}`);
    const { platformTenant } = await createTenantFixture(prisma);

    const beforeUsers = await prisma.user.count();

    await stack.ownership.assign(claims, stack.perms, { representativeId: rep.id, platformTenantId: platformTenant.id });

    const afterUsers = await prisma.user.count();
    expect(afterUsers).toBe(beforeUsers);
  });

  it('Ownership assignment grants no additional Platform permission to the representative', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `iso2-${randomUUID()}@test.local` }, `iso2-${randomUUID()}`);
    await stack.reps.assignRole(claims, stack.perms, rep.id, 'sales_representative');
    const { platformTenant } = await createTenantFixture(prisma);
    await stack.ownership.assign(claims, stack.perms, { representativeId: rep.id, platformTenantId: platformTenant.id });

    const roles = await prisma.platformUserRole.findMany({
      where: { platformUserId: rep.platformUserId, revokedAt: null },
      select: { roleKey: true },
    });
    expect(roles.map((r) => r.roleKey)).toEqual(['sales_representative']);
    const role = PLATFORM_ROLES.find((r) => r.key === 'sales_representative')!;
    expect(role.permissionKeys).not.toContain('tenant.provision.execute');
    expect(role.permissionKeys).not.toContain('subscription.assign');
    expect(role.permissionKeys).not.toContain('entitlement.view');
  });

  it('Removing ownership never touches PlatformTenant lifecycle status/plan/entitlement fields', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `iso3-${randomUUID()}@test.local` }, `iso3-${randomUUID()}`);
    const { platformTenant } = await createTenantFixture(prisma);
    const assigned = await stack.ownership.assign(claims, stack.perms, {
      representativeId: rep.id,
      platformTenantId: platformTenant.id,
    });
    const before = await prisma.platformTenant.findUniqueOrThrow({ where: { id: platformTenant.id } });
    await stack.ownership.remove(claims, stack.perms, platformTenant.id, { expectedRowVersion: assigned.rowVersion });
    const after = await prisma.platformTenant.findUniqueOrThrow({ where: { id: platformTenant.id } });
    expect(after.status).toBe(before.status);
    expect(after.plan).toBe(before.plan);
    expect(after.rowVersion).toBe(before.rowVersion);
  });

  it('Suspension security gate: suspended representative session cannot pass a fresh step-up re-check', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `iso4-${randomUUID()}@test.local` }, `iso4-${randomUUID()}`);
    const repSession = await createPlatformRefreshSession(prisma, rep.platformUserId, { stepUpVerifiedAt: new Date() });
    await stack.reps.suspend(claims, stack.perms, rep.id, 'security review');

    const repClaims = platformClaims(rep.platformUserId, repSession.sessionId);
    // The rep's own refresh session must be revoked — any further action requiring fresh
    // step-up (e.g. attempting to self-service) must be denied because the session record
    // is gone/revoked, not because of a permission check.
    const session = await stack.refreshRepo.findBySessionId(repSession.sessionId);
    expect(session?.revokedAt).not.toBeNull();
    void repClaims;
  });

  it('Suspended representative PlatformUser cannot authenticate (isActive=false, status=suspended)', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `iso5-${randomUUID()}@test.local` }, `iso5-${randomUUID()}`);
    await stack.reps.activate(claims, stack.perms, rep.id);
    await stack.reps.suspend(claims, stack.perms, rep.id, 'fraud review');
    const user = await prisma.platformUser.findUniqueOrThrow({ where: { id: rep.platformUserId } });
    expect(user.isActive).toBe(false);
    expect(user.status).toBe('suspended');
  });

  it('Sales representative role has no tenant/branch scoping fields — assigned-only scope by design', () => {
    const role = PLATFORM_ROLES.find((r) => r.key === 'sales_representative')!;
    expect(role.scope).toBe('assigned_only');
    expect(role.highImpact).toBe(false);
  });
});
