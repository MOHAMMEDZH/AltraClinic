import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  buildSearchCacheKey,
  clearSearchCache,
  readSearchCache,
  readSearchCacheForIdentity,
  writeSearchCache,
} from './lib/search-cache';
import {
  extractSearchContributions,
  isCatalogSearchEntryIncluded,
  listExecutableContributions,
  resolveAccessibleModuleIds,
} from './lib/search-resolver';
import {
  buildRegistrySearchSnapshot,
  buildRestrictedSearchSnapshot,
  buildStaticSearchSnapshot,
} from './lib/search-snapshot-builder';
import {
  applyDeepLinkTemplate,
  resolveSearchHitUrl,
} from './lib/resolve-search-hit-url';
import { resolveEntityTypesParam, resolveSingleEntityTypeParam } from './lib/resolve-entity-types-param';
import { STATIC_SEARCH_CATALOG, getCatalogEntryByEntityType } from './lib/static-search-catalog';
import { isRegistrySearchEnabled } from './lib/static-search-flags';
import {
  assertSearchCatalogValid,
  assertSearchSnapshotValid,
  verifySearchCatalogParity,
  verifySearchParity,
} from './lib/search-validation';
import { listAllBuiltinSearchContributions } from '@booking/module-registry/search';

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


function buildStaticParityEntityTypes(roles: string[]): string[] {
  return buildStaticSearchSnapshot(roles, STATIC_SEARCH_CATALOG, 'static-fallback').entityTypes.sort();
}

describe('search catalog', () => {
  it('validates catalog integrity', () => {
    expect(assertSearchCatalogValid(STATIC_SEARCH_CATALOG), assertSearchCatalogValid().join('\n')).toEqual([]);
  });

  it('preserves multi-resource treatment permissions', () => {
    const treatment = getCatalogEntryByEntityType('treatment');
    expect(treatment?.resourceIds).toEqual(['api.dental', 'api.beauty']);
  });

  it('matches builtin manifest parity including resourceIds', () => {
    const mismatches = verifySearchCatalogParity(
      listAllBuiltinSearchContributions(),
      STATIC_SEARCH_CATALOG,
    );
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });
});

describe('search resolver', () => {
  it('extracts search contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractSearchContributions(views);
    expect(contributions.length).toBe(35);
    expect(listExecutableContributions(contributions)).toHaveLength(26);
  });

  it('never includes discovery entities in executable contributions', () => {
    const views = buildViews(['owner']);
    const executable = listExecutableContributions(extractSearchContributions(views));
    expect(executable.every((entry) => entry.searchScope === 'executable')).toBe(true);
    expect(executable.some((entry) => entry.discoveryKey)).toBe(false);
  });

  it('gates catalog entries by extension-level accessibility', () => {
    const views = buildViews(['receptionist']);
    const contributions = extractSearchContributions(views);
    const billingInvoice = STATIC_SEARCH_CATALOG.find((entry) => entry.entityType === 'invoice')!;
    expect(isCatalogSearchEntryIncluded(billingInvoice, views, contributions)).toBe(false);
    const patient = STATIC_SEARCH_CATALOG.find((entry) => entry.entityType === 'patient')!;
    expect(isCatalogSearchEntryIncluded(patient, views, contributions)).toBe(true);
  });

  it('excludes executable entities when module license is hidden', () => {
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
    const contributions = extractSearchContributions(views);
    const analytics = STATIC_SEARCH_CATALOG.find((entry) => entry.discoveryKey === 'analytics-metric')!;
    expect(isCatalogSearchEntryIncluded(analytics, views, contributions)).toBe(false);
  });
});

describe('search snapshot builder', () => {
  it('builds registry snapshot with executable types only in typesParam', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistrySearchSnapshot(
      ['owner'],
      STATIC_SEARCH_CATALOG,
      views,
      1,
      'active',
    );
    expect(assertSearchSnapshotValid(snapshot), assertSearchSnapshotValid(snapshot).join('\n')).toEqual([]);
    expect(snapshot.entityTypes).toHaveLength(26);
    expect(snapshot.typesParam.split(',')).toHaveLength(26);
    expect(snapshot.discoveryEntries.length).toBeGreaterThan(0);
    expect(snapshot.canSearch).toBe(true);
  });

  it('builds static snapshot from catalog permissions', () => {
    const snapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.entityTypes.length).toBeGreaterThan(20);
    expect(snapshot.typesParam).toBe(snapshot.entityTypes.join(','));
  });

  it.each(['owner', 'general_manager'] as const)(
    'registry vs static RBAC parity for %s executable types',
    (role) => {
      const roles = [role];
      const views = buildViews(roles);
      const staticSnapshot = buildStaticSearchSnapshot(roles, STATIC_SEARCH_CATALOG, 'static-fallback');
      const registrySnapshot = buildRegistrySearchSnapshot(
        roles,
        STATIC_SEARCH_CATALOG,
        views,
        1,
        'active',
      );
      const mismatches = verifySearchParity(staticSnapshot, registrySnapshot);
      expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
    },
  );

  it('registry executable types are a subset of static RBAC for receptionist', () => {
    const roles = ['receptionist'];
    const views = buildViews(roles);
    const staticTypes = new Set(buildStaticParityEntityTypes(roles));
    const registryTypes = buildRegistrySearchSnapshot(
      roles,
      STATIC_SEARCH_CATALOG,
      views,
      1,
      'active',
    ).entityTypes;
    for (const entityType of registryTypes) {
      expect(staticTypes.has(entityType), entityType).toBe(true);
    }
  });

  it('includes inventory and report for owner static snapshot', () => {
    const snapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    expect(snapshot.entityTypes).toContain('inventory');
    expect(snapshot.entityTypes).toContain('report');
  });

  it('tracks enabled module ids from accessible modules', () => {
    const views = buildViews(['doctor']);
    const snapshot = buildRegistrySearchSnapshot(
      ['doctor'],
      STATIC_SEARCH_CATALOG,
      views,
      1,
      'active',
    );
    const accessible = resolveAccessibleModuleIds(views);
    expect(snapshot.enabledModuleIds.every((id) => accessible.has(id))).toBe(true);
  });
});

describe('search cache', () => {
  afterEach(() => {
    clearSearchCache();
  });

  it('stores and reads identity-scoped snapshots', () => {
    const snapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    const key = buildSearchCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 42,
      entitlementVersion: 'v1',
      moduleCount: 21,
      source: 'registry',
    });
    writeSearchCache(key, snapshot);
    expect(readSearchCache(key)?.typesParam).toBe(snapshot.typesParam);
    clearSearchCache();
    expect(readSearchCache(key)).toBeNull();
  });

  it('isolates cache entries by rolesHash', () => {
    const ownerSnapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    const receptionistSnapshot = buildStaticSearchSnapshot(['receptionist'], STATIC_SEARCH_CATALOG);
    const ownerKey = buildSearchCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'v1',
      moduleCount: 21,
      source: 'registry',
    });
    const receptionistKey = buildSearchCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'receptionist',
      catalogGeneration: 1,
      entitlementVersion: 'v1',
      moduleCount: 21,
      source: 'registry',
    });
    writeSearchCache(ownerKey, ownerSnapshot);
    writeSearchCache(receptionistKey, receptionistSnapshot);
    expect(readSearchCache(ownerKey)?.entityTypes).not.toEqual(
      readSearchCache(receptionistKey)?.entityTypes,
    );
  });
});

describe('search hit navigation', () => {
  it('prefers API url over catalog template', () => {
    const url = resolveSearchHitUrl(
      { type: 'patient', id: 'p1', url: '/patients/p1' },
      { patient: '/patients/{id}' },
    );
    expect(url).toBe('/patients/p1');
  });

  it('resolves catalog deep link templates with composite ids', () => {
    const template = '/dental/chart/{patientId}/plan/{planId}';
    expect(applyDeepLinkTemplate(template, { id: 'pat1:plan9' })).toBe('/dental/chart/pat1/plan/plan9');
  });

  it('resolves patient deep link from snapshot maps', () => {
    const snapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    const url = resolveSearchHitUrl({ type: 'patient', id: 'abc' }, snapshot.deepLinkByEntityType);
    expect(url).toBe('/patients/abc');
  });

  it('scopes entity type param to snapshot executable types', () => {
    const snapshot = buildRegistrySearchSnapshot(
      ['receptionist'],
      STATIC_SEARCH_CATALOG,
      buildViews(['receptionist']),
      1,
      'active',
    );
    expect(resolveSingleEntityTypeParam(snapshot, 'patient')).toBe('patient');
    expect(resolveSingleEntityTypeParam(snapshot, 'invoice')).toBe('');
    expect(resolveEntityTypesParam(snapshot, ['patient', 'invoice'])).toBe('patient');
  });
});

describe('loading fallback', () => {
  afterEach(() => {
    clearSearchCache();
  });

  it('restricted snapshot is fail-closed with no executable types', () => {
    const snapshot = buildRestrictedSearchSnapshot(1, 'v1');
    expect(snapshot.canSearch).toBe(false);
    expect(snapshot.typesParam).toBe('');
    expect(snapshot.entityTypes).toEqual([]);
    expect(snapshot.source).toBe('registry');
  });

  it('restricted snapshot never exceeds registry executable types for receptionist', () => {
    const roles = ['receptionist'];
    const views = buildViews(roles);
    const registrySnapshot = buildRegistrySearchSnapshot(
      roles,
      STATIC_SEARCH_CATALOG,
      views,
      1,
      'active',
    );
    const restricted = buildRestrictedSearchSnapshot();
    const registryTypes = new Set(registrySnapshot.entityTypes);

    for (const entityType of restricted.entityTypes) {
      expect(registryTypes.has(entityType), entityType).toBe(true);
    }
  });

  it('readSearchCacheForIdentity returns registry snapshot for matching identity', () => {
    const ownerSnapshot = buildStaticSearchSnapshot(['owner'], STATIC_SEARCH_CATALOG);
    const ownerKey = buildSearchCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      catalogGeneration: 1,
      entitlementVersion: 'v1',
      moduleCount: 21,
      source: 'registry',
    });
    writeSearchCache(ownerKey, { ...ownerSnapshot, source: 'registry' });

    expect(
      readSearchCacheForIdentity({
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'owner',
        catalogGeneration: 1,
        entitlementVersion: 'v1',
      })?.typesParam,
    ).toBe(ownerSnapshot.typesParam);

    expect(
      readSearchCacheForIdentity({
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'receptionist',
        catalogGeneration: 1,
        entitlementVersion: 'v1',
      }),
    ).toBeNull();
  });
});

describe('rollback flag', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables registry search when VITE_USE_STATIC_SEARCH_ONLY=true', () => {
    vi.stubEnv('VITE_USE_STATIC_SEARCH_ONLY', 'true');
    expect(isRegistrySearchEnabled()).toBe(false);
  });

  it('enables registry search by default', () => {
    vi.stubEnv('VITE_USE_STATIC_SEARCH_ONLY', '');
    expect(isRegistrySearchEnabled()).toBe(true);
  });
});

describe('runtime search types', () => {
  it('does not hardcode default types in search-api', async () => {
    const { globalClinicalSearch } = await import('@/features/search/api/search-api');
    expect(globalClinicalSearch.length).toBeGreaterThanOrEqual(4);
  });
});
