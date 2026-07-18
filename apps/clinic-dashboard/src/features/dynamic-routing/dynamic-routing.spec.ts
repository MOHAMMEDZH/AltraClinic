import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  extractRoutingContributions,
  isCatalogRouteIncluded,
  normalizeRegistryPath,
  resolveAccessibleModuleIds,
} from './lib/route-resolver';
import {
  buildRegistryRouteSnapshot,
  buildStaticRouteSnapshot,
} from './lib/route-tree-builder';
import {
  STATIC_ROUTE_CATALOG,
  collectShellRoutes,
  flattenCatalogPaths,
} from './lib/static-route-catalog';
import { assertRouteCatalogValid, verifyRouteParity } from './lib/route-validation';
import { isRegistryRoutingEnabled } from './lib/static-route-flags';

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

describe('route catalog', () => {
  it('validates all component keys and structure', () => {
    expect(() => assertRouteCatalogValid(STATIC_ROUTE_CATALOG)).not.toThrow();
  });

  it('includes all legacy shell paths', () => {
    const paths = flattenCatalogPaths(collectShellRoutes(STATIC_ROUTE_CATALOG));
    expect(paths).toContain('/');
    expect(paths).toContain('/appointments');
    expect(paths).toContain('/settings/subscription');
    expect(paths).toContain('/workflows/instances');
    expect(paths).toContain('/billing/commissions');
  });
});

describe('route resolver', () => {
  it('extracts routing contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractRoutingContributions(views);
    expect(contributions.length).toBeGreaterThan(10);
    expect(contributions.some((c) => c.path.includes('/patients'))).toBe(true);
    expect(contributions.every((c) => c.moduleId)).toBe(true);
  });

  it('filters modules by accessible set', () => {
    const views = buildViews(['receptionist']);
    const accessible = resolveAccessibleModuleIds(views);
    expect(accessible.has('analytics')).toBe(false);
    expect(accessible.has('queue')).toBe(true);
  });

  it('normalizes registry wildcard paths', () => {
    expect(normalizeRegistryPath('/billing/*')).toBe('/billing');
  });

  it('gates catalog routes by module contributions', () => {
    const views = buildViews(['doctor']);
    const contributions = extractRoutingContributions(views);
    expect(
      isCatalogRouteIncluded('emr', '/encounters', views, contributions),
    ).toBe(true);
    expect(
      isCatalogRouteIncluded('settings', '/settings/subscription', views, contributions),
    ).toBe(false);
  });
});

describe('route tree builder', () => {
  it('builds static snapshot with full parity paths', () => {
    const snapshot = buildStaticRouteSnapshot(collectShellRoutes(STATIC_ROUTE_CATALOG));
    const mismatches = verifyRouteParity(collectShellRoutes(STATIC_ROUTE_CATALOG), snapshot);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
    expect(snapshot.routeObjects.length).toBeGreaterThan(0);
  });

  it('owner registry snapshot matches static parity', () => {
    const views = buildViews(['owner']);
    const staticSnapshot = buildStaticRouteSnapshot(collectShellRoutes(STATIC_ROUTE_CATALOG));
    const registrySnapshot = buildRegistryRouteSnapshot(
      collectShellRoutes(STATIC_ROUTE_CATALOG),
      views,
      1,
      'active',
    );
    const mismatches = verifyRouteParity(collectShellRoutes(STATIC_ROUTE_CATALOG), registrySnapshot);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
    expect(registrySnapshot.paths.length).toBe(staticSnapshot.paths.length);
  });

  it('receptionist registry snapshot excludes analytics routes', () => {
    const views = buildViews(['receptionist']);
    const registrySnapshot = buildRegistryRouteSnapshot(
      collectShellRoutes(STATIC_ROUTE_CATALOG),
      views,
      1,
      'active',
    );
    expect(registrySnapshot.paths).not.toContain('/analytics');
    expect(registrySnapshot.paths).toContain('/queue');
  });
});

describe('rollback flag', () => {
  it('disables registry routing when VITE_USE_STATIC_ROUTES_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_ROUTES_ONLY', 'true');
    expect(isRegistryRoutingEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });
});
