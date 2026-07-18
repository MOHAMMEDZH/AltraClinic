import { describe, expect, it, vi } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import {
  CANONICAL_DASHBOARD_WIDGET_IDS,
  validateBuiltinDashboardIntegrity,
} from '@booking/module-registry/dashboard';
import { hasPermission } from '@booking/permissions';
import {
  extractDashboardContributions,
  isCatalogWidgetIncluded,
  isCatalogWidgetIncludedByModule,
  resolveAccessibleModuleIds,
} from './lib/dashboard-resolver';
import {
  buildRegistryDashboardSnapshot,
  buildStaticDashboardSnapshot,
} from './lib/dashboard-layout-resolver';
import { STATIC_DASHBOARD_CATALOG } from './lib/static-dashboard-catalog';
import {
  assertDashboardCatalogValid,
  buildStaticParityWidgetIds,
  verifyDashboardParity,
} from './lib/dashboard-validation';
import { isRegistryDashboardEnabled } from './lib/static-dashboard-flags';
import { getCatalogEntry } from './lib/static-dashboard-catalog';

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

const ROLE_PROFILES = [
  'owner',
  'general_manager',
  'branch_manager',
  'receptionist',
  'doctor',
  'dentist',
  'nurse',
  'accountant',
  'inventory_manager',
] as const;

describe('dashboard catalog', () => {
  it('validates all widget ids and structure', () => {
    expect(() => assertDashboardCatalogValid(STATIC_DASHBOARD_CATALOG)).not.toThrow();
    expect(STATIC_DASHBOARD_CATALOG.length).toBe(20);
  });

  it('matches canonical widget vocabulary from module-registry', () => {
    const catalogIds = STATIC_DASHBOARD_CATALOG.map((e) => e.id).sort();
    const canonicalIds = [...CANONICAL_DASHBOARD_WIDGET_IDS].sort();
    expect(catalogIds).toEqual(canonicalIds);
    expect(validateBuiltinDashboardIntegrity(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('maps resource ids to licensed modules', () => {
    const scheduling = getCatalogEntry('today-appointments');
    expect(scheduling?.moduleId).toBe('scheduling');
    const kpi = getCatalogEntry('kpi-overview');
    expect(kpi?.moduleId).toBe('core');
  });
});

describe('dashboard resolver', () => {
  it('extracts dashboard contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractDashboardContributions(views);
    expect(contributions.length).toBe(20);
    expect(contributions.some((c) => c.moduleId === 'dashboard')).toBe(true);
    expect(contributions.every((c) => c.widgetId && c.componentKey)).toBe(true);
  });

  it('filters modules by accessible set', () => {
    const views = buildViews(['receptionist']);
    const accessible = resolveAccessibleModuleIds(views);
    expect(accessible.has('analytics')).toBe(false);
    expect(accessible.has('queue')).toBe(true);
  });

  it('gates catalog widgets by module contributions', () => {
    const views = buildViews(['doctor']);
    const contributions = extractDashboardContributions(views);
    const billingEntry = getCatalogEntry('revenue-summary')!;
    expect(isCatalogWidgetIncluded(billingEntry, views, contributions)).toBe(false);
    const emrEntry = getCatalogEntry('treatment-stats')!;
    expect(isCatalogWidgetIncluded(emrEntry, views, contributions)).toBe(true);
    expect(
      isCatalogWidgetIncludedByModule(billingEntry.moduleId, views, contributions),
    ).toBe(false);
  });

  it('excludes widgets when module is hidden by license', () => {
    const graph = resolveDependencyGraph(BUILTIN_MODULE_MANIFESTS);
    const views = resolveEffectiveModuleViews({
      manifests: BUILTIN_MODULE_MANIFESTS,
      licenseModules: { ...ALL_ENABLED, analytics: 'hidden' },
      moduleFlags: {},
      canWrite: true,
      canMutate: true,
      licenseStatus: 'active',
      permissionEvaluator: {
        hasPermission: (resourceId, action = 'view') =>
          hasPermission(['owner'], resourceId, action),
      },
      dependencyOrder: graph.order,
      dependencyHealthByModule: graph.healthByModule,
    });
    const snapshot = buildRegistryDashboardSnapshot(
      ['owner'],
      STATIC_DASHBOARD_CATALOG,
      views,
      1,
      'active',
    );
    expect(snapshot.widgetIds).not.toContain('revenue-chart');
    expect(snapshot.widgetIds).not.toContain('business-health');
  });
});

describe('dashboard layout resolver', () => {
  it('builds static snapshot with full profile widgets', () => {
    const snapshot = buildStaticDashboardSnapshot(['owner'], STATIC_DASHBOARD_CATALOG);
    expect(snapshot.widgetIds.length).toBeGreaterThan(10);
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.profile).toBe('owner');
  });

  it.each(ROLE_PROFILES)('owner-class parity for %s registry vs static RBAC', (role) => {
    const roles = [role];
    const views = buildViews(roles);
    const staticIds = buildStaticParityWidgetIds(roles);
    const registrySnapshot = buildRegistryDashboardSnapshot(
      roles,
      STATIC_DASHBOARD_CATALOG,
      views,
      1,
      'active',
    );
    const mismatches = verifyDashboardParity(staticIds, registrySnapshot);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('receptionist registry snapshot excludes analytics widgets', () => {
    const views = buildViews(['receptionist']);
    const snapshot = buildRegistryDashboardSnapshot(
      ['receptionist'],
      STATIC_DASHBOARD_CATALOG,
      views,
      1,
      'active',
    );
    expect(snapshot.widgetIds).not.toContain('revenue-chart');
    expect(snapshot.widgetIds).toContain('queue-status');
    expect(snapshot.widgetIds).toContain('today-appointments');
  });

  it('accountant registry snapshot includes finance widgets', () => {
    const views = buildViews(['accountant']);
    const snapshot = buildRegistryDashboardSnapshot(
      ['accountant'],
      STATIC_DASHBOARD_CATALOG,
      views,
      1,
      'active',
    );
    expect(snapshot.widgetIds).toContain('revenue-summary');
    expect(snapshot.widgetIds).toContain('outstanding-payments');
    expect(snapshot.widgetIds).toContain('business-health');
  });
});

describe('rollback flag', () => {
  it('disables registry dashboard when VITE_USE_STATIC_DASHBOARD_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_DASHBOARD_ONLY', 'true');
    expect(isRegistryDashboardEnabled()).toBe(false);
    vi.unstubAllEnvs();
  });

  it('enables registry dashboard by default', () => {
    vi.stubEnv('VITE_USE_STATIC_DASHBOARD_ONLY', undefined);
    expect(isRegistryDashboardEnabled()).toBe(true);
    vi.unstubAllEnvs();
  });
});
