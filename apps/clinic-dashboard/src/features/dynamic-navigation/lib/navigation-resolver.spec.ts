import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { filterNavItems, CLINIC_NAV_ITEMS, hasPermission } from '@booking/permissions';
import { resolveNavigationItems } from './navigation-resolver';
import { toSidebarNavItems } from './navigation-builder';
import { verifySidebarParity } from './navigation-parity';
import { STATIC_NAV_ROLE_BY_PATH } from './static-nav-role-map';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((m) => [m.moduleId, 'enabled' as const]),
);

function buildViews(roles: string[]) {
  const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
  return resolveEffectiveModuleViews({
    manifests: BUILTIN_MODULE_MANIFESTS,
    licenseModules: ALL_ENABLED,
    moduleFlags: {},
    canWrite: true,
    canMutate: true,
    licenseStatus: 'active',
    permissionEvaluator: {
      hasPermission: (resourceId, action = 'view') => hasPermission(roles, resourceId, action),
    },
    dependencyOrder: graph.order,
    dependencyHealthByModule: graph.healthByModule,
  });
}

describe('navigation resolver', () => {
  it('builds sidebar items from EffectiveModuleView only', () => {
    const views = buildViews(['owner']);
    const sidebar = resolveNavigationItems(views, 'sidebar', {
      roles: ['owner'],
      roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
      accessibleOnly: true,
    });
    expect(sidebar.length).toBeGreaterThan(10);
    expect(sidebar.every((item) => item.moduleId !== 'static')).toBe(true);
  });

  it('matches static navigation for owner role', () => {
    const views = buildViews(['owner']);
    const dynamic = toSidebarNavItems(
      resolveNavigationItems(views, 'sidebar', {
        roles: ['owner'],
        roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
        accessibleOnly: true,
      }),
    );
    const mismatches = verifySidebarParity(dynamic, ['owner']);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('matches static navigation for receptionist role', () => {
    const views = buildViews(['receptionist']);
    const dynamic = toSidebarNavItems(
      resolveNavigationItems(views, 'sidebar', {
        roles: ['receptionist'],
        roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
        accessibleOnly: true,
      }),
    );
    const mismatches = verifySidebarParity(dynamic, ['receptionist']);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('shows patient portal nav only for patient role', () => {
    const views = buildViews(['patient']);
    const sidebar = resolveNavigationItems(views, 'sidebar', {
      roles: ['patient'],
      roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
      accessibleOnly: true,
    });
    const paths = sidebar.map((item) => item.path);
    expect(paths).toContain('/my-appointments');
    expect(paths).not.toContain('/patients');
  });

  it('filters inaccessible modules from licensing', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { ...ALL_ENABLED, analytics: 'hidden' },
      moduleFlags: {},
      canWrite: true,
      canMutate: true,
      licenseStatus: 'active',
      permissionEvaluator: { hasPermission: () => true },
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
    });
    const sidebar = resolveNavigationItems(views, 'sidebar', {
      roles: ['owner'],
      roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
      accessibleOnly: true,
    });
    expect(sidebar.some((item) => item.path === '/analytics')).toBe(false);
  });

  it('respects static ordering parity with filterNavItems baseline', () => {
    const views = buildViews(['owner']);
    const dynamic = toSidebarNavItems(
      resolveNavigationItems(views, 'sidebar', {
        roles: ['owner'],
        roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
        accessibleOnly: true,
      }),
    );
    const staticItems = filterNavItems(CLINIC_NAV_ITEMS, ['owner']);
    expect(dynamic.map((i) => i.path)).toEqual(staticItems.map((i) => i.path));
  });

  it('matches static navigation for accountant role', () => {
    const views = buildViews(['accountant']);
    const dynamic = toSidebarNavItems(
      resolveNavigationItems(views, 'sidebar', {
        roles: ['accountant'],
        roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
        accessibleOnly: true,
      }),
    );
    const mismatches = verifySidebarParity(dynamic, ['accountant']);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('matches static navigation for branch_manager role', () => {
    const views = buildViews(['branch_manager']);
    const dynamic = toSidebarNavItems(
      resolveNavigationItems(views, 'sidebar', {
        roles: ['branch_manager'],
        roleConstraintsByPath: STATIC_NAV_ROLE_BY_PATH,
        accessibleOnly: true,
      }),
    );
    const mismatches = verifySidebarParity(dynamic, ['branch_manager']);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });
});
