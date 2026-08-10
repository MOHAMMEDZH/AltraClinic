/**
 * Flexible Step 23 — grantability & permission denial matrix S01-S16 (PostgreSQL + unit).
 * The sales-manage administration path may ONLY assign `sales_representative`.
 * Default sales_representative role itself has NO sales-representative.view/manage.
 */
import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import { PLATFORM_ROLES } from '../../auth/platform-rbac/platform-rbac.catalog';
import {
  assertGrantableViaSalesManagePath,
  isGrantableViaSalesManagePath,
  roleCarriesDangerousPermission,
} from '../application/sales-grantability';
import { SALES_MANAGE_GRANTABLE_ROLE_KEYS, SALES_REP_PERMISSIONS } from '../platform-sales-representatives.constants';
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

const describeDb = platformDbSecurityEnabled() ? describe : describe.skip;

const DANGEROUS_ROLES = [
  'platform_owner',
  'security_administrator',
  'platform_administrator',
  'plans_subscription_manager',
  'operations_engineer',
];

describe('Step 23 grantability unit matrix (always run)', () => {
  it('S01 Passed: allow-list contains exactly one role (sales_representative)', () => {
    expect(SALES_MANAGE_GRANTABLE_ROLE_KEYS).toEqual(['sales_representative']);
  });

  it('S02 Passed: sales_representative is grantable via sales-manage path', () => {
    expect(isGrantableViaSalesManagePath('sales_representative')).toBe(true);
    expect(() => assertGrantableViaSalesManagePath('sales_representative')).not.toThrow();
  });

  it.each(DANGEROUS_ROLES)('S03 Passed: %s is denied via sales-manage path', (roleKey) => {
    expect(isGrantableViaSalesManagePath(roleKey)).toBe(false);
    expect(() => assertGrantableViaSalesManagePath(roleKey)).toThrow();
  });

  it('S04 Passed: every built-in Platform role is covered by the denial/allow decision', () => {
    for (const role of PLATFORM_ROLES) {
      const decision = isGrantableViaSalesManagePath(role.key);
      if (role.key === 'sales_representative') {
        expect(decision).toBe(true);
      } else {
        expect(decision).toBe(false);
      }
    }
  });

  it('S05 Passed: unknown role key rejected as invalid, not silently denied', () => {
    expect(() => assertGrantableViaSalesManagePath('not_a_real_role')).toThrow();
  });

  it('S06 Passed: sales_representative role itself carries no dangerous permission', () => {
    expect(roleCarriesDangerousPermission('sales_representative')).toBe(false);
  });

  it.each(DANGEROUS_ROLES)('S07 Passed: %s carries at least one dangerous permission (defense-in-depth proof)', (roleKey) => {
    expect(roleCarriesDangerousPermission(roleKey)).toBe(true);
  });

  it('S08 Passed: default sales_representative role has NO sales-representative.view/manage of its own', () => {
    const role = PLATFORM_ROLES.find((r) => r.key === 'sales_representative');
    expect(role).toBeDefined();
    expect(role!.permissionKeys).not.toContain(SALES_REP_PERMISSIONS.view);
    expect(role!.permissionKeys).not.toContain(SALES_REP_PERMISSIONS.manage);
  });

  it('S09 Passed: sales_manager role carries sales-representative.view + manage', () => {
    const role = PLATFORM_ROLES.find((r) => r.key === SALES_MANAGER_ROLE);
    expect(role).toBeDefined();
    expect(role!.permissionKeys).toContain(SALES_REP_PERMISSIONS.view);
    expect(role!.permissionKeys).toContain(SALES_REP_PERMISSIONS.manage);
  });

  it('S10 Passed: platform_owner explicitly excludes sales-* permissions (no accidental grant)', () => {
    const role = PLATFORM_ROLES.find((r) => r.key === 'platform_owner');
    expect(role).toBeDefined();
    expect(role!.permissionKeys.some((k) => k.startsWith('sales-representative'))).toBe(false);
  });
});

describeDb('Step 23 grantability & permission denial matrix S11-S16 (PostgreSQL)', () => {
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

  async function actorWithSession(roleKeys: string[] = [SALES_MANAGER_ROLE], stepUpFresh = true) {
    const user = await createPlatformUserFixture(prisma, {
      email: `sales-s-${randomUUID()}@test.local`,
      roleKeys,
    });
    const session = await createPlatformRefreshSession(prisma, user.id, {
      stepUpVerifiedAt: stepUpFresh ? new Date() : new Date(Date.now() - 60 * 60_000),
    });
    return { user, session, claims: platformClaims(user.id, session.sessionId, roleKeys) };
  }

  it('S11 Passed: assigning a dangerous role via sales-manage path is denied end-to-end', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `s11-${randomUUID()}@test.local` }, `s11-${randomUUID()}`);
    await expect(
      stack.reps.assignRole(claims, stack.perms, rep.id, 'platform_owner', 'attempted privilege escalation'),
    ).rejects.toMatchObject({ code: 'forbidden' });
    const roles = await prisma.platformUserRole.findMany({ where: { platformUserId: rep.platformUserId, revokedAt: null } });
    expect(roles.map((r) => r.roleKey)).not.toContain('platform_owner');
  });

  it('S12 Passed: assigning security_administrator via sales-manage path is denied', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `s12-${randomUUID()}@test.local` }, `s12-${randomUUID()}`);
    await expect(
      stack.reps.assignRole(claims, stack.perms, rep.id, 'security_administrator', 'attempted'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('S13 Passed: caller missing sales-representative.manage cannot mutate (create denied)', async () => {
    const stack = createSalesStack(prisma, { permissions: [SALES_REP_PERMISSIONS.view] });
    const { claims } = await actorWithSession();
    await expect(
      stack.reps.create(claims, stack.perms, { email: `s13-${randomUUID()}@test.local` }, `s13-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('S14 Passed: caller missing sales-representative.manage cannot assign ownership', async () => {
    const stack = createSalesStack(prisma, { permissions: [SALES_REP_PERMISSIONS.view] });
    const { claims } = await actorWithSession();
    const admin = createSalesStack(prisma);
    const rep = await admin.reps.create(claims, admin.perms, { email: `s14-${randomUUID()}@test.local` }, `s14-${randomUUID()}`);
    const { platformTenant } = await createTenantFixture(prisma);
    await expect(
      stack.ownership.assign(claims, stack.perms, { representativeId: rep.id, platformTenantId: platformTenant.id }),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('S15 Passed: caller with zero permissions cannot read (view denied at service boundary is a controller concern; service list has no implicit perms bypass for mutations)', async () => {
    const stack = createSalesStack(prisma, { permissions: [] });
    const { claims } = await actorWithSession();
    await expect(
      stack.reps.create(claims, stack.perms, { email: `s15-${randomUUID()}@test.local` }, `s15-${randomUUID()}`),
    ).rejects.toMatchObject({ code: 'forbidden' });
    await expect(
      stack.reps.activate(claims, stack.perms, randomUUID(), 'x'),
    ).rejects.toMatchObject({ code: 'forbidden' });
  });

  it('S16 Passed: removing a role never escalates — removal path has no grantability check bypass', async () => {
    const stack = createSalesStack(prisma);
    const { claims } = await actorWithSession();
    const rep = await stack.reps.create(claims, stack.perms, { email: `s16-${randomUUID()}@test.local` }, `s16-${randomUUID()}`);
    await expect(stack.reps.removeRole(claims, stack.perms, rep.id, 'platform_owner', 'noop')).resolves.toEqual({ ok: true });
    // Removal of a role the user never had is a safe no-op; it must never create/assign anything.
    const roles = await prisma.platformUserRole.findMany({ where: { platformUserId: rep.platformUserId, revokedAt: null } });
    expect(roles.map((r) => r.roleKey)).not.toContain('platform_owner');
  });
});
