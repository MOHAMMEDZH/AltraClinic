import { describe, expect, it } from 'vitest';
import {
  SUPER_ADMIN_ROUTES,
  assertRegistryIntegrity,
  getRouteById,
  getRouteByPath,
  listNavRoutes,
  listNavRoutesByGroup,
} from './route-registry';

const FORBIDDEN_KEYS = ['role', 'roles', 'roleName', 'roleNames', 'requiredRole', 'requiredRoles'];

describe('SUPER_ADMIN_ROUTES registry', () => {
  it('passes integrity checks', () => {
    expect(() => assertRegistryIntegrity()).not.toThrow();
  });

  it('has unique route ids', () => {
    const ids = SUPER_ADMIN_ROUTES.map((route) => route.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has unique route paths', () => {
    const paths = SUPER_ADMIN_ROUTES.map((route) => route.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('never carries role-name authorization fields', () => {
    for (const route of SUPER_ADMIN_ROUTES) {
      const keys = Object.keys(route);
      for (const forbidden of FORBIDDEN_KEYS) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it('does not register a standalone home ("/") route', () => {
    expect(SUPER_ADMIN_ROUTES.some((route) => route.path === '/')).toBe(false);
  });

  it('every route with anyOf/allOf policy has a non-empty permission list', () => {
    for (const route of SUPER_ADMIN_ROUTES) {
      if (route.policy.type === 'anyOf' || route.policy.type === 'allOf') {
        expect(route.policy.permissions.length).toBeGreaterThan(0);
      }
    }
  });

  it('every breadcrumbParentId points at a registered route', () => {
    for (const route of SUPER_ADMIN_ROUTES) {
      if (route.breadcrumbParentId) {
        expect(getRouteById(route.breadcrumbParentId)).toBeTruthy();
      }
    }
  });

  it('getRouteById finds registered routes and returns undefined for unknown ids', () => {
    expect(getRouteById('overview')?.path).toBe('/overview');
    expect(getRouteById('does-not-exist')).toBeUndefined();
  });

  it('getRouteByPath resolves static paths', () => {
    expect(getRouteByPath('/overview')?.id).toBe('overview');
    expect(getRouteByPath('/platform-users')?.id).toBe('platform-users');
    expect(getRouteByPath('/unknown-path')).toBeUndefined();
  });

  it('getRouteByPath prefers static literal routes over parameterized ones', () => {
    expect(getRouteByPath('/platform-users/invite')?.id).toBe('platform-users-invite');
    expect(getRouteByPath('/platform-users/user-123')?.id).toBe('platform-users-detail');
    expect(getRouteByPath('/mfa-reset-requests/req-1')?.id).toBe('mfa-reset-approve');
    expect(getRouteByPath('/add-ons/new')?.id).toBe('add-ons-new');
    expect(getRouteByPath('/add-ons/addon-1')?.id).toBe('add-ons-detail');
    expect(getRouteByPath('/commercial-overrides/new')?.id).toBe('commercial-overrides-new');
    expect(getRouteByPath('/commercial-composition/preview')?.id).toBe('commercial-composition-preview');
  });

  it('registers Step 15 add-ons and overrides routes as available after plans', () => {
    const plansIdx = SUPER_ADMIN_ROUTES.findIndex((route) => route.id === 'plans');
    const addOnsIdx = SUPER_ADMIN_ROUTES.findIndex((route) => route.id === 'add-ons');
    const overridesIdx = SUPER_ADMIN_ROUTES.findIndex((route) => route.id === 'commercial-overrides');
    expect(addOnsIdx).toBeGreaterThan(plansIdx);
    expect(overridesIdx).toBeGreaterThan(addOnsIdx);
    expect(getRouteById('add-ons')?.step).toBe(15);
    expect(getRouteById('add-ons')?.status).toBe('available');
    expect(getRouteById('commercial-overrides')?.status).toBe('available');
    expect(getRouteById('commercial-composition-preview')?.policy).toEqual({
      type: 'anyOf',
      permissions: ['addon.view', 'override.view', 'plan.view'],
    });
  });

  it('getRouteByPath tolerates trailing slashes and query strings', () => {
    expect(getRouteByPath('/overview/')?.id).toBe('overview');
    expect(getRouteByPath('/overview?foo=bar')?.id).toBe('overview');
  });

  it('listNavRoutes fails closed for a signed-out principal', () => {
    expect(listNavRoutes(null)).toEqual([]);
  });

  it('listNavRoutes only returns routes the principal is permitted to see', () => {
    const principal = { permissions: ['platform-user.view'] };
    const navIds = listNavRoutes(principal).map((route) => route.id);
    expect(navIds).toContain('overview'); // authenticated-only
    expect(navIds).toContain('platform-users');
    expect(navIds).not.toContain('tenants');
    expect(navIds).not.toContain('roles');
  });

  it('never grants nav visibility via a role-name bypass', () => {
    // Intentionally probing a principal shape that also carries role data — the
    // registry must ignore it entirely and evaluate permissions only.
    const principalWithRoleOnly = {
      permissions: [] as string[],
      roleKeys: ['super_admin'],
    };
    const navIds = listNavRoutes(principalWithRoleOnly).map((route) => route.id);
    expect(navIds).toEqual(['overview']);
  });

  it('listNavRoutesByGroup groups routes and omits empty groups', () => {
    const principal = { permissions: ['tenant.view'] };
    const groups = listNavRoutesByGroup(principal);
    const groupNames = groups.map((entry) => entry.group);
    expect(groupNames).toContain('overview');
    expect(groupNames).toContain('platform');
    expect(groupNames).not.toContain('sales');
  });

  it('every showInNav route declares a navGroup and navLabelKey', () => {
    for (const route of SUPER_ADMIN_ROUTES) {
      if (route.showInNav) {
        expect(route.navGroup).toBeTruthy();
        expect(route.navLabelKey).toBeTruthy();
      }
    }
  });
});
