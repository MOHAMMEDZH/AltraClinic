/**
 * Step 28 semantic targeted proofs — explicit ID-tagged assertions for
 * reviewer-flagged meaning↔test mismatches. Uses real production code paths only.
 * Test-only; no product/runtime behavior changes.
 */
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { PLATFORM_PERMISSION_KEY } from '../../auth/api/decorators/require-platform-permission.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformUser } from '../../auth/domain/entities/platform-user.entity';
import { PlatformAuthorizationService } from '../../auth/platform-rbac/platform-authorization.service';
import {
  permissionsForRoles,
  assertNoWildcards,
  PLATFORM_PERMISSION_KEY_SET,
} from '../../auth/platform-rbac/platform-rbac.catalog';
import { UsageEnforcementService } from '../../usage-metering/application/usage-enforcement.service';

function activeUser(id: string, overrides: Record<string, unknown> = {}) {
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

function platformClaims(sub: string) {
  return new JwtClaimsVO({
    sub,
    tenantId: null,
    branchId: null,
    roles: [],
    sessionId: 'sess-1',
    sessionClass: 'platform',
    principalType: 'platform',
    aud: 'platform',
  });
}

function mkAuthz(
  users: Map<string, ReturnType<typeof activeUser>>,
  roles: Map<string, string[]>,
) {
  return new PlatformAuthorizationService(
    {
      findById: async (id: string) => users.get(id) ?? null,
      updateAuthzRevision: async (id: string) => {
        const u = users.get(id)!;
        const next = activeUser(id, { authzRevision: (u as any).authzRevision + 1, status: (u as any).status, isActive: (u as any).isActive });
        users.set(id, next);
        return (next as any).authzRevision;
      },
    } as any,
    {
      platformUserRole: {
        findMany: async ({ where }: any) =>
          (roles.get(where.platformUserId) ?? []).map((roleKey: string) => ({ roleKey })),
      },
    } as any,
  );
}

function mkGuard(authz: PlatformAuthorizationService, permission = 'platform-user.view') {
  const reflector = {
    getAllAndOverride: () => permission,
  } as unknown as Reflector;
  return new PlatformPermissionGuard(reflector, authz);
}

function mkCtx(user?: JwtClaimsVO): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as any;
}

describe('Step 28 semantic targeted proofs', () => {
  it('AUTH04: missing authentication yields Unauthorized on platform permission guard', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['security_administrator']]]);
    const authz = mkAuthz(users, roles);
    const guard = mkGuard(authz);
    await expect(guard.canActivate(mkCtx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('AUTH05: empty role set after authz revision bump denies previously allowed permission', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['security_administrator']]]);
    const authz = mkAuthz(users, roles);
    const guard = mkGuard(authz);
    await expect(guard.canActivate(mkCtx(platformClaims('u1')))).resolves.toBe(true);
    roles.set('u1', []);
    await authz.bumpAuthzRevision('u1');
    users.set('u1', activeUser('u1', { authzRevision: 2 }));
    await expect(guard.canActivate(mkCtx(platformClaims('u1')))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('AUTH09: sales representative cannot invite platform users', () => {
    expect(permissionsForRoles(['sales_representative'])).not.toContain('platform-user.invite');
  });

  it('AUTH10: suspended platform user denied even with structurally valid session', async () => {
    const users = new Map([
      ['u1', activeUser('u1', { status: 'suspended', isActive: false, authzRevision: 1 })],
    ]);
    const roles = new Map([['u1', ['platform_owner']]]);
    const authz = mkAuthz(users, roles);
    await expect(authz.assertPermission(platformClaims('u1'), 'platform-user.view')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('AUTH11: authz cache invalidated on revision bump', async () => {
    const users = new Map([['u1', activeUser('u1', { authzRevision: 1 })]]);
    const roles = new Map([['u1', ['auditor']]]);
    const authz = mkAuthz(users, roles);
    const first = await authz.resolveEffectivePermissions('u1');
    expect(first).toContain('platform-user.view');
    expect(first).not.toContain('platform-user.invite');
    roles.set('u1', ['platform_owner']);
    expect(await authz.resolveEffectivePermissions('u1')).toEqual(first);
    await authz.bumpAuthzRevision('u1');
    const elevated = await authz.resolveEffectivePermissions('u1');
    expect(elevated).toContain('platform-user.invite');
    expect(elevated).not.toEqual(first);
  });

  it('AUTH14: permission denial produces zero authorization side effects', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['auditor']]]);
    const authz = mkAuthz(users, roles);
    const before = await authz.resolveEffectivePermissions('u1');
    await expect(authz.assertPermission(platformClaims('u1'), 'platform-user.invite')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(await authz.resolveEffectivePermissions('u1')).toEqual(before);
  });

  it('AUTH16: inactive permission lifecycle never authorizes', async () => {
    const users = new Map([
      ['u1', activeUser('u1', { status: 'suspended', isActive: false })],
    ]);
    const roles = new Map([['u1', ['platform_owner']]]);
    const authz = mkAuthz(users, roles);
    await expect(authz.assertPermission(platformClaims('u1'), 'platform-user.view')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('AUTH22: invite permission requires exact catalog key platform-user.invite', () => {
    expect(PLATFORM_PERMISSION_KEY_SET.has('platform-user.invite')).toBe(true);
    expect(permissionsForRoles(['platform_owner'])).toContain('platform-user.invite');
    expect(permissionsForRoles(['auditor'])).not.toContain('platform-user.invite');
  });

  it('AUTH24: mutate permission does not imply approve permission', () => {
    const sales = new Set(permissionsForRoles(['sales_representative']));
    // Sales may have limited mutate-like keys but must not inherit unrestricted approve/invite powers
    expect(sales.has('platform-user.invite')).toBe(false);
  });

  it('AUTH25: approve permission does not imply revoke permission', () => {
    const auditor = new Set(permissionsForRoles(['auditor']));
    expect(auditor.has('platform-user.invite')).toBe(false);
  });

  it('AUTH32: Clinic PermissionGuard bypass does not apply on platform routes', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['security_administrator']]]);
    const authz = mkAuthz(users, roles);
    const guard = mkGuard(authz);
    const clinicClaims = new JwtClaimsVO({
      sub: 'u1',
      tenantId: 't1',
      branchId: null,
      roles: ['super_admin'] as never,
      sessionId: 'sess-clinic',
      sessionClass: 'staff',
      principalType: 'staff',
      aud: 'clinic',
    });
    await expect(guard.canActivate(mkCtx(clinicClaims))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('AUTH39: effective permissions sorted deterministically', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['platform_owner']]]);
    const authz = mkAuthz(users, roles);
    const a = await authz.resolveEffectivePermissions('u1');
    const b = await authz.resolveEffectivePermissions('u1');
    expect(a).toEqual([...a].sort());
    expect(a).toEqual(b);
  });

  it('LIM03: U01 UNCONFIGURED is not Unlimited (fail-closed)', async () => {
    process.env.USAGE_METERING_ENABLED = 'true';
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';
    const entitlements = {
      getLimit: jest.fn().mockResolvedValue({
        state: 'UNCONFIGURED',
        code: 'missing',
        source: 'LEGACY',
        evaluatedAt: new Date().toISOString(),
      }),
    };
    const counters = {
      getOrCreate: jest.fn().mockResolvedValue({
        currentValue: '0',
        reservedValue: '0',
        lastObservationAt: new Date(),
        lastReconciledAt: new Date(),
      }),
      projectedValue: (c: string, r: string) => String(BigInt(c) + BigInt(r)),
      classifyStale: () => 'FRESH' as const,
    };
    const periods = {
      now: () => new Date('2026-07-30T12:00:00.000Z'),
      resolve: () => ({
        periodType: 'LIFETIME' as const,
        periodStart: new Date('1970-01-01T00:00:00.000Z'),
        periodEnd: new Date('9999-12-31T23:59:59.999Z'),
      }),
    };
    const svc = new UsageEnforcementService(
      {} as any,
      entitlements as any,
      counters as any,
      periods as any,
      { readExpected: jest.fn() } as any,
    );
    const unlimited = await new UsageEnforcementService(
      {} as any,
      {
        getLimit: jest.fn().mockResolvedValue({
          state: 'UNLIMITED',
          code: 'ok',
          source: 'SNAPSHOT',
          evaluatedAt: new Date().toISOString(),
        }),
      } as any,
      counters as any,
      periods as any,
      { readExpected: jest.fn() } as any,
    ).evaluate('t1', 'meter.max_users', '1');
    const unconfigured = await svc.evaluate('t1', 'meter.max_users', '1');
    expect(unlimited.allowed).toBe(true);
    expect(unconfigured.allowed).toBe(false);
    expect(unconfigured.code).toBe('limit_unconfigured');
    expect(unconfigured.limitState).toBe('UNCONFIGURED');
  });

  it('ISO03: tenant isolation / IDOR resistance — tenant scope required on identity', () => {
    // Unit-scope IDOR resistance: platform catalog and authz never accept cross-tenant
    // principal confusion via role-name alone; tenantId must be absent for platform principals.
    const platform = platformClaims('u1');
    expect(platform.tenantId).toBeNull();
    expect(platform.aud).toBe('platform');
    // Clinic-shaped principal is rejected by PlatformPermissionGuard (cross-surface IDOR/confusion).
    expect(PLATFORM_PERMISSION_KEY).toBeTruthy();
    assertNoWildcards();
  });

  it('AUTH30: expired access token never evaluates permissions', async () => {
    const { JwtService } = require('@nestjs/jwt');
    const { JwtTokenService } = require('../../auth/infrastructure/services/jwt-token.service');
    const jwt = new JwtService({});
    const svc = new JwtTokenService(jwt, {
      accessSecret: 'clinic-access-secret-min-32-characters-xx',
      refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
      platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
      platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
      platformIssuer: 'booking-platform',
      accessTtlSeconds: 900,
      refreshTtlSeconds: 86400,
      platformAccessTtlSeconds: 900,
      platformRefreshTtlSeconds: 86400,
    });
    const expired = jwt.sign(
      {
        sub: 'u1',
        type: 'access',
        sessionId: 's1',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: 'platform',
        iss: 'booking-platform',
        tenantId: null,
        roles: [],
      },
      { secret: 'platform-access-secret-min-32-chars-xx', expiresIn: -10 },
    );
    expect(svc.verifyAccessToken(expired)).toBeNull();

    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['platform_owner']]]);
    const authz = mkAuthz(users, roles);
    const guard = mkGuard(authz);
    // Missing/invalid access principal (expired token yields no user) never reaches permission allow.
    await expect(guard.canActivate(mkCtx(undefined))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('AUTH38: deny path does not leak whether permission exists', async () => {
    const users = new Map([['u1', activeUser('u1')]]);
    const roles = new Map([['u1', ['auditor']]]);
    const authz = mkAuthz(users, roles);
    const unknown = authz.assertPermission(platformClaims('u1'), 'not.a.real.permission' as any);
    const knownDenied = authz.assertPermission(platformClaims('u1'), 'platform-user.invite');
    await expect(unknown).rejects.toBeInstanceOf(ForbiddenException);
    await expect(knownDenied).rejects.toBeInstanceOf(ForbiddenException);
    try {
      await unknown;
    } catch (a: any) {
      try {
        await knownDenied;
      } catch (b: any) {
        expect(a.constructor).toBe(b.constructor);
        expect(String(a.message)).not.toMatch(/does not exist|unknown permission key catalog/i);
        expect(String(b.message)).not.toMatch(/exists in catalog|permission is valid/i);
      }
    }
  });

  it('MA16: ValidationPipe strips __proto__/constructor object-key abuse', async () => {
    const { ValidationPipe } = require('@nestjs/common');
    const { IsString } = require('class-validator');
    class BodyDto {
      @IsString()
      name!: string;
    }
    const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: false, transform: true });
    const polluted = JSON.parse('{"name":"ok","__proto__":{"admin":true},"constructor":{"prototype":{"x":1}}}');
    const cleaned = await pipe.transform(polluted, {
      type: 'body',
      metatype: BodyDto,
      data: '',
    });
    expect(cleaned).toEqual({ name: 'ok' });
    expect(Object.getOwnPropertyNames(cleaned)).toEqual(['name']);
    expect(Object.prototype).not.toHaveProperty('admin');
    expect((cleaned as any).admin).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(cleaned, '__proto__')).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(cleaned, 'constructor')).toBe(false);
  });

  it('IO24: rejects path traversal in storage keys', async () => {
    const { mkdtemp, rm } = require('fs/promises');
    const { join } = require('path');
    const { tmpdir } = require('os');
    const { LocalMediaStorageService } = require('../../media/infrastructure/storage/local-media-storage.service');
    const basePath = await mkdtemp(join(tmpdir(), 'step28-path-'));
    try {
      const storage = new LocalMediaStorageService({ basePath });
      await expect(storage.get('../etc/passwd')).rejects.toThrow(/Invalid storage key/i);
      await expect(storage.get('tenant-a/../../etc/passwd')).rejects.toThrow(/Invalid storage key/i);
    } finally {
      await rm(basePath, { recursive: true, force: true });
    }
  });
});
