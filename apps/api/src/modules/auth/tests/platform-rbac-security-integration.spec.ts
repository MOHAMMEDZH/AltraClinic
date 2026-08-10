import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformPermissionGuard } from '../api/guards/platform-permission.guard';
import { JwtClaimsVO } from '../domain/value-objects/jwt-claims.vo';
import { PlatformUser } from '../domain/entities/platform-user.entity';
import { PlatformAuthorizationService } from '../platform-rbac/platform-authorization.service';
import { PlatformSodService } from '../platform-rbac/platform-sod.service';
import { permissionsForRoles } from '../platform-rbac/platform-rbac.catalog';
import { PLATFORM_PERMISSION_KEY } from '../api/decorators/require-platform-permission.decorator';

function activeUser(id: string, overrides: Partial<Parameters<typeof PlatformUser.restore>[0]> = {}) {
  const now = new Date();
  return PlatformUser.restore({
    id,
    email: `${id}@example.com`,
    passwordHash: 'hash',
    displayName: id,
    isActive: true,
    status: 'active',
    authzRevision: 1,
    lockedUntil: null,
    failedLoginCount: 0,
    passwordChangedAt: now,
    lastLoginAt: now,
    lastLoginIp: null,
    createdAt: now,
    updatedAt: now,
    mfaEnabled: true,
    mfaSecretEncrypted: 'enc',
    mfaKeyVersion: '1',
    mfaPendingSecretEncrypted: null,
    mfaPendingExpiresAt: null,
    mfaConfirmedAt: now,
    lastTotpStep: null,
    failedMfaCount: 0,
    ...overrides,
  } as any);
}

function platformClaims(sub: string, sessionId = 'sess-1') {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId,
    sessionClass: 'platform',
    principalType: 'platform',
    aud: 'platform',
  });
}

function staffClaims(sub: string) {
  return new JwtClaimsVO({
    sub,
    tenantId: 'tenant-1',
    branchId: null,
    roles: ['super_admin' as any],
    sessionId: 'clinic-sess',
    sessionClass: 'staff',
    principalType: 'staff',
    aud: 'clinic',
  });
}

describe('platform RBAC security integration (application path)', () => {
  it('denies tenant/staff tokens and allows platform permission path', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['security_administrator']]]);
    const authz = new PlatformAuthorizationService(
      {
        findById: async (id: string) => users.get(id) ?? null,
        updateAuthzRevision: async (id: string) => {
          const u = users.get(id)!;
          const next = activeUser(id, { authzRevision: u.authzRevision + 1 });
          users.set(id, next);
          return next.authzRevision;
        },
      } as any,
      {
        platformUserRole: {
          findMany: async ({ where }: any) =>
            (roles.get(where.platformUserId) ?? []).map((roleKey: string) => ({ roleKey })),
        },
      } as any,
    );
    const reflector = {
      getAllAndOverride: () => 'platform-user.view',
    } as unknown as Reflector;
    const guard = new PlatformPermissionGuard(reflector, authz);

    const mkCtx = (user?: JwtClaimsVO): ExecutionContext =>
      ({
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
        getHandler: () => ({}),
        getClass: () => ({}),
      }) as any;

    await expect(guard.canActivate(mkCtx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(mkCtx(staffClaims('u1')))).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(guard.canActivate(mkCtx(platformClaims('u1')))).resolves.toBe(true);

    roles.set('u1', []);
    await authz.bumpAuthzRevision('u1');
    users.set('u1', activeUser('u1', { authzRevision: 2 }));
    await expect(guard.canActivate(mkCtx(platformClaims('u1')))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('does not grant permissions for legacy super_admin role name', async () => {
    expect(permissionsForRoles(['super_admin' as any])).toEqual([]);
    const users = new Map([['u1', activeUser('u1')]]);
    const authz = new PlatformAuthorizationService(
      { findById: async (id: string) => users.get(id) ?? null } as any,
      {
        platformUserRole: {
          findMany: async () => [{ roleKey: 'super_admin' }],
        },
      } as any,
    );
    await expect(authz.assertPermission(platformClaims('u1'), 'platform-user.view')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('denies suspended and no-role users; invalidates authz cache on revision bump', async () => {
    const users = new Map([['u1', activeUser('u1', { authzRevision: 1 })]]);
    const roles = new Map([['u1', ['auditor']]]);
    const authz = new PlatformAuthorizationService(
      {
        findById: async (id: string) => users.get(id) ?? null,
        updateAuthzRevision: async (id: string) => {
          const u = users.get(id)!;
          const next = activeUser(id, { authzRevision: u.authzRevision + 1 });
          users.set(id, next);
          return next.authzRevision;
        },
      } as any,
      {
        platformUserRole: {
          findMany: async ({ where }: any) =>
            (roles.get(where.platformUserId) ?? []).map((roleKey: string) => ({ roleKey })),
        },
      } as any,
    );

    const first = await authz.resolveEffectivePermissions('u1');
    expect(first).toContain('platform-user.view');
    expect(first).not.toContain('platform-user.invite');

    roles.set('u1', ['platform_owner']);
    // stale cache still returns auditor perms until revision bump
    expect(await authz.resolveEffectivePermissions('u1')).toEqual(first);
    await authz.bumpAuthzRevision('u1');
    const elevated = await authz.resolveEffectivePermissions('u1');
    expect(elevated).toContain('platform-user.invite');

    users.set('u1', activeUser('u1', { status: 'suspended', isActive: false, authzRevision: 3 }));
    await expect(authz.assertPermission(platformClaims('u1'), 'platform-user.view')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('enforces SoD for self-elevation, last owner, and MFA reset parties', async () => {
    const sod = new PlatformSodService({
      countActiveOwners: jest.fn().mockResolvedValue(1),
      countActiveSecurityAdmins: jest.fn().mockResolvedValue(1),
      resolveActiveRoleKeys: jest.fn().mockResolvedValue(['platform_owner']),
    } as any);
    expect(() => sod.assertNotSelf('a', 'a', 'assign roles')).toThrow(ForbiddenException);
    await expect(sod.assertCanRemoveRole('owner', 'platform_owner')).rejects.toThrow(ForbiddenException);
    await expect(sod.assertCanSuspend('actor', 'owner')).rejects.toThrow(ForbiddenException);
    expect(() => sod.assertMfaResetApprover('req', 'req', 'target')).toThrow(ForbiddenException);
    expect(() => sod.assertMfaResetApprover('req', 'target', 'target')).toThrow(ForbiddenException);
    expect(() => sod.assertMfaResetApprover('req', 'approver', 'target')).not.toThrow();
  });

  it('unknown permission fails closed; tenant permission keys do not satisfy platform keys', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const authz = new PlatformAuthorizationService(
      { findById: async (id: string) => users.get(id) ?? null } as any,
      {
        platformUserRole: {
          findMany: async () => [{ roleKey: 'platform_owner' }],
        },
      } as any,
    );
    await expect(authz.assertPermission(platformClaims('u1'), 'tenant.admin' as any)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    await expect(authz.assertPermission(platformClaims('u1'), 'not.a.real.permission')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('guard metadata key is required for permission enforcement', () => {
    expect(PLATFORM_PERMISSION_KEY).toBeTruthy();
  });
});
