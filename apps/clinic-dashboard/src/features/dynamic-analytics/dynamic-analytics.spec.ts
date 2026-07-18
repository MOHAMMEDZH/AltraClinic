import { describe, expect, it, afterEach } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  buildAnalyticsCacheKey,
  clearAnalyticsCache,
  readAnalyticsCache,
  readAnalyticsCacheForIdentity,
  writeAnalyticsCache,
} from './lib/analytics-cache';
import {
  extractAnalyticsContributions,
  isCatalogAnalyticsEntryIncluded,
  isHubAnalyticsId,
  resolveAnalyticsCapabilities,
  SCHEDULABLE_ANALYTICS_REPORT_IDS,
} from './lib/analytics-resolver';
import {
  buildRegistryAnalyticsSnapshot,
  buildRestrictedAnalyticsSnapshot,
  buildStaticAnalyticsSnapshot,
  getSnapshotDomainById,
  getSnapshotWidgetByCatalogId,
} from './lib/analytics-snapshot-builder';
import {
  findAnalyticsDomainInSnapshot,
  snapshotDomainsToAnalyticsDomains,
  snapshotWidgetToCatalogItem,
} from './lib/analytics-domain-adapter';
import { STATIC_ANALYTICS_CATALOG } from './lib/static-analytics-catalog';
import {
  assertAnalyticsCatalogValid,
  assertAnalyticsSnapshotValid,
} from './lib/analytics-validation';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((m) => [m.moduleId, 'enabled' as const]),
);

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner' };

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

const ROLE_PROFILES = ['owner', 'general_manager', 'receptionist', 'accountant'] as const;

describe('analytics catalog', () => {
  it('validates catalog integrity', () => {
    expect(assertAnalyticsCatalogValid(), assertAnalyticsCatalogValid().join('\n')).toEqual([]);
  });

  it('identifies hub analytics ids', () => {
    expect(isHubAnalyticsId('hub.catalog')).toBe(true);
    expect(isHubAnalyticsId('executive')).toBe(false);
  });

  it('declares schedulable analytics report links', () => {
    expect(SCHEDULABLE_ANALYTICS_REPORT_IDS.size).toBeGreaterThan(0);
  });
});

describe('analytics resolver', () => {
  it('extracts analytics contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractAnalyticsContributions(views);
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions.every((entry) => entry.extensionId.includes('/analytics/'))).toBe(true);
  });

  it('gates catalog entries by extension-level accessibility', () => {
    const ownerViews = buildViews(['owner']);
    const receptionistViews = buildViews(['receptionist']);
    const ownerContributions = extractAnalyticsContributions(ownerViews);
    const receptionistContributions = extractAnalyticsContributions(receptionistViews);
    const forecasting = STATIC_ANALYTICS_CATALOG.find((entry) => entry.localId === 'forecasting')!;
    expect(isCatalogAnalyticsEntryIncluded(forecasting, receptionistViews, receptionistContributions)).toBe(false);
    expect(isCatalogAnalyticsEntryIncluded(forecasting, ownerViews, ownerContributions)).toBe(true);
  });

  it('derives capabilities from accessible snapshot entries', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    const capabilities = resolveAnalyticsCapabilities(snapshot);
    expect(capabilities.canViewAnalytics).toBe(true);
    expect(capabilities.canCreateDashboards).toBe(true);
    expect(capabilities.canExportAnalytics).toBe(true);
    expect(capabilities.canScheduleAnalytics).toBe(true);
  });
});

describe('analytics snapshot builder', () => {
  it('builds registry snapshot with domains, widgets, and hubs separated', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryAnalyticsSnapshot(
      ['owner'],
      STATIC_ANALYTICS_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    expect(assertAnalyticsSnapshotValid(snapshot), assertAnalyticsSnapshotValid(snapshot).join('\n')).toEqual([]);
    expect(snapshot.domains.length).toBe(11);
    expect(snapshot.widgets.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.hubs.length).toBe(3);
    expect(snapshot.canViewAnalytics).toBe(true);
  });

  it('builds static snapshot from catalog permissions', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.domains.length).toBe(11);
    expect(snapshot.widgets.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.categories.length).toBeGreaterThan(0);
  });

  it('builds restricted snapshot fail-closed', () => {
    const snapshot = buildRestrictedAnalyticsSnapshot(IDENTITY, 1, 'active');
    expect(snapshot.domains).toEqual([]);
    expect(snapshot.widgets).toEqual([]);
    expect(snapshot.hubs).toEqual([]);
    expect(snapshot.canViewAnalytics).toBe(false);
    expect(snapshot.canCreateDashboards).toBe(false);
    expect(snapshot.canExportAnalytics).toBe(false);
    expect(snapshot.canScheduleAnalytics).toBe(false);
  });

  it.each(['owner', 'general_manager'] as const)(
    'registry domains are subset of static RBAC for %s',
    (role) => {
      const roles = [role];
      const views = buildViews(roles);
      const staticIds = new Set(
        buildStaticAnalyticsSnapshot(roles, STATIC_ANALYTICS_CATALOG, IDENTITY, 'static-fallback').domains.map(
          (domain) => domain.domainId,
        ),
      );
      const registryIds = buildRegistryAnalyticsSnapshot(
        roles,
        STATIC_ANALYTICS_CATALOG,
        views,
        1,
        'active',
        IDENTITY,
      ).domains.map((domain) => domain.domainId);
      for (const domainId of registryIds) {
        expect(staticIds.has(domainId), domainId).toBe(true);
      }
    },
  );

  it('maps snapshot domains to legacy analytics domain shape', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    const domain = getSnapshotDomainById(snapshot, 'executive');
    expect(domain).toBeDefined();
    const legacy = snapshotDomainsToAnalyticsDomains(snapshot)[0];
    expect(legacy.id).toBeDefined();
    expect(legacy.route).toMatch(/^\/analytics\//);
  });

  it('maps snapshot widgets to legacy widget catalog shape', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    const widget = getSnapshotWidgetByCatalogId(snapshot, 'revenueTrend');
    expect(widget).toBeDefined();
    const legacy = snapshotWidgetToCatalogItem(widget!);
    expect(legacy.id).toBe('revenueTrend');
    expect(legacy.metricName).toBe('revenue_total');
  });

  it('finds domain in snapshot adapter', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    expect(findAnalyticsDomainInSnapshot(snapshot, 'financial')?.route).toBe('/analytics/financial');
  });
});

describe('analytics cache', () => {
  afterEach(() => {
    clearAnalyticsCache();
  });

  it('stores and reads identity-scoped cache entries', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    const key = buildAnalyticsCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      moduleCount: 43,
      source: 'registry',
    });
    writeAnalyticsCache(key, { ...snapshot, source: 'registry' });
    expect(readAnalyticsCache(key)?.domains.length).toBe(snapshot.domains.length);
  });

  it('reads cache by partial identity during loading', () => {
    const snapshot = buildRestrictedAnalyticsSnapshot(IDENTITY, 1, 'active');
    const key = buildAnalyticsCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      moduleCount: 43,
      source: 'registry',
    });
    writeAnalyticsCache(key, snapshot);
    expect(
      readAnalyticsCacheForIdentity({
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'owner',
        catalogGeneration: 1,
        entitlementVersion: 'active',
      }),
    ).toEqual(snapshot);
  });

  it('clears cache on clearAnalyticsCache', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    const key = buildAnalyticsCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: null,
      entitlementVersion: null,
      moduleCount: 0,
      source: 'static-only',
    });
    writeAnalyticsCache(key, snapshot);
    clearAnalyticsCache();
    expect(readAnalyticsCache(key)).toBeNull();
  });
});

describe('analytics role profiles', () => {
  it.each(ROLE_PROFILES)('builds valid static snapshot for %s', (role) => {
    const snapshot = buildStaticAnalyticsSnapshot([role], STATIC_ANALYTICS_CATALOG, IDENTITY);
    expect(assertAnalyticsSnapshotValid(snapshot), assertAnalyticsSnapshotValid(snapshot).join('\n')).toEqual([]);
  });
});

describe('analytics static catalog parity', () => {
  it('static owner snapshot matches legacy domain count', () => {
    const snapshot = buildStaticAnalyticsSnapshot(['owner'], STATIC_ANALYTICS_CATALOG, IDENTITY);
    expect(snapshot.domains).toHaveLength(11);
    expect(snapshot.widgets.length).toBeGreaterThanOrEqual(8);
    expect(snapshot.hubs).toHaveLength(3);
  });
});

