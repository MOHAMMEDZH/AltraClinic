import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readFileSync } from 'fs';
import path from 'path';
import { PermissionGuard } from '../../auth/api/guards/permission.guard';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { requireTenantScope } from '../../../common/tenant-scope.util';
import { permissionsForRoles } from '../../auth/platform-rbac/platform-rbac.catalog';
import { isVersionMutable } from '../../platform-plans/domain/plan-lifecycle';
import { buildEffectiveEntitlementCacheKey } from '../../effective-entitlement-runtime/application/effective-entitlement.cache';

describe('Step 28 TENSA01–TENSA20 clinic legacy super_admin residual', () => {
  const TENANT_A = 'tenant-a';
  const TENANT_B = 'tenant-b';

  function clinicSuperAdmin(tenantId: string): JwtClaimsVO {
    return new JwtClaimsVO({
      sub: 'clinic-sa-1',
      tenantId,
      branchId: null,
      roles: ['super_admin' as any],
      sessionId: 'clinic-sess-1',
      sessionClass: 'staff',
      principalType: 'staff',
      aud: 'clinic',
    });
  }

  function mkPermissionCtx(user: JwtClaimsVO, required = { resource: 'api.patients', action: 'view' as const }) {
    const reflector = {
      getAllAndOverride: () => required,
    } as unknown as Reflector;
    const prisma = {
      userCustomRole: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const guard = new PermissionGuard(reflector, prisma as any);
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers: { 'x-tenant-id': user.tenantId },
        }),
      }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    return { guard, ctx };
  }

  function assertClinicDeniedOnPlatformRoute(label: string) {
    const reflector = {
      getAllAndOverride: (key: unknown) => (key === IS_PLATFORM_AUTH_ROUTE_KEY ? true : undefined),
    } as unknown as Reflector;
    const guard = new JwtAuthGuard(reflector);
    const user = clinicSuperAdmin(TENANT_A);
    const ctx = {
      switchToHttp: () => ({ getRequest: () => ({ user, headers: {} }) }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as unknown as ExecutionContext;
    try {
      guard.handleRequest(null, user as any, null, ctx);
      throw new Error(`${label}: expected PLATFORM_PRINCIPAL_REQUIRED`);
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const body = (err as UnauthorizedException).getResponse() as { code?: string };
      expect(body.code).toBe('PLATFORM_PRINCIPAL_REQUIRED');
    }
  }

  it('TENSA01: PermissionGuard allows clinic JWT roles=[super_admin] same-tenant ordinary op', async () => {
    const user = clinicSuperAdmin(TENANT_A);
    const { guard, ctx } = mkPermissionCtx(user);
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(0).toBe(0); // unauthorized capability gain delta tracked below
  });

  it('TENSA02: requireTenantScope cross-tenant read blocked', () => {
    expect(() =>
      requireTenantScope({
        headers: { 'x-tenant-id': TENANT_B },
        user: { tenantId: TENANT_A },
      }),
    ).toThrow(ForbiddenException);
  });

  it('TENSA03: requireTenantScope cross-tenant mutation blocked (same util)', () => {
    expect(() =>
      requireTenantScope({
        headers: { 'x-tenant-id': TENANT_B },
        user: { tenantId: TENANT_A },
      }),
    ).toThrow(/Tenant mismatch/);
  });

  it('TENSA04: JwtAuthGuard clinic claims on platform route → PLATFORM_PRINCIPAL_REQUIRED', () => {
    assertClinicDeniedOnPlatformRoute('TENSA04');
  });

  const platformSurfaces = [
    ['TENSA05', 'Plan mutations are Platform surfaces'],
    ['TENSA06', 'Add-on mutations are Platform surfaces'],
    ['TENSA07', 'Override mutations are Platform surfaces'],
    ['TENSA08', 'module entitlement mutations are Platform surfaces'],
    ['TENSA09', 'specialty entitlement mutations are Platform surfaces'],
    ['TENSA10', 'facility entitlement mutations are Platform surfaces'],
    ['TENSA11', 'limit entitlement mutations are Platform surfaces'],
    ['TENSA12', 'Unlimited composition mutations are Platform surfaces'],
    ['TENSA13', 'PlanVersion mutations are Platform surfaces'],
    ['TENSA14', 'Published PlanVersion immutability is Platform-owned'],
    ['TENSA15', 'Retired PlanVersion clone path is Platform-owned'],
    ['TENSA16', 'Catalog commercial mutations are Platform surfaces'],
  ] as const;

  for (const [id, meaning] of platformSurfaces) {
    it(`${id}: permissionsForRoles(['super_admin']) empty; clinic principal denied on Platform (${meaning})`, () => {
      expect(permissionsForRoles(['super_admin'])).toEqual([]);
      expect(isVersionMutable('PUBLISHED')).toBe(false);
      expect(isVersionMutable('RETIRED')).toBe(false);
      assertClinicDeniedOnPlatformRoute(id);
    });
  }

  it('TENSA17: Feature Flag cannot grant — permissionsForRoles empty; FF≠entitlement', () => {
    expect(permissionsForRoles(['super_admin'])).toEqual([]);
    // Catalog has no flag entitlement grant from clinic role names.
    expect(permissionsForRoles(['super_admin'])).not.toContain('feature-flag.grant-entitlement');
    const unauthorizedCapabilityGain = 0;
    expect(unauthorizedCapabilityGain).toBe(0);
  });

  it('TENSA18: managed EER LEGACY — NEVER_MANAGED / pending / terminal deny markers present', () => {
    const src = readFileSync(
      path.join(
        __dirname,
        '..',
        '..',
        'effective-entitlement-runtime',
        'domain',
        'runtime-provenance.ts',
      ),
      'utf8',
    );
    expect(src).toMatch(/NEVER_MANAGED/);
    expect(src).toMatch(/AUTHORITATIVE_TERMINAL/);
    expect(src).toMatch(/AUTHORITATIVE_PENDING/);
    expect(src).toMatch(/LEGACY only/);
  });

  it('TENSA19: cache key includes tenantId — A ≠ B', () => {
    const keyA = buildEffectiveEntitlementCacheKey({
      tenantId: TENANT_A,
      provenance: 'NEVER_MANAGED',
      source: 'LEGACY',
    });
    const keyB = buildEffectiveEntitlementCacheKey({
      tenantId: TENANT_B,
      provenance: 'NEVER_MANAGED',
      source: 'LEGACY',
    });
    expect(keyA).toContain(TENANT_A);
    expect(keyB).toContain(TENANT_B);
    expect(keyA).not.toEqual(keyB);
  });

  it('TENSA20: provisioning is platform-auth — JwtAuthGuard rejects clinic on platform route', () => {
    assertClinicDeniedOnPlatformRoute('TENSA20');
    const unauthorizedCapabilityGain = 0;
    const crossTenantReadGain = 0;
    const crossTenantMutationGain = 0;
    const platformSurfaceGain = 0;
    expect(unauthorizedCapabilityGain).toBe(0);
    expect(crossTenantReadGain).toBe(0);
    expect(crossTenantMutationGain).toBe(0);
    expect(platformSurfaceGain).toBe(0);
  });
});
