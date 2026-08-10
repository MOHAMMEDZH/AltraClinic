import { describe, expect, it } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import { STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY } from '@booking/module-registry/activity';
import {
  buildActivityCacheKey,
  clearActivityCache,
  readActivityCache,
  writeActivityCache,
} from './lib/activity-cache';
import {
  extractActivityContributions,
  isCatalogActivityEntryIncluded,
} from './lib/activity-resolver';
import { resolveActivityCapabilities } from './lib/activity-capabilities';
import {
  buildRegistryActivitySnapshot,
  buildRestrictedActivitySnapshot,
  buildStaticActivitySnapshot,
  getSnapshotFeedById,
} from './lib/activity-snapshot-builder';
import { STATIC_ACTIVITY_CATALOG } from './lib/static-activity-catalog';
import {
  assertActivityCatalogLoaded,
  assertActivitySnapshotValid,
} from './lib/activity-validation';
import { resolveActivityWidgetConfig } from './lib/activity-read-model';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((m) => [m.moduleId, 'enabled' as const]),
);

const IDENTITY = { tenantId: 'tenant-1', userId: 'user-1', rolesHash: 'owner', branchId: null };

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

describe('dynamic activity resolver & snapshot', () => {
  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('loads catalog at bootstrap without errors', () => {
    expect(() => assertActivityCatalogLoaded()).not.toThrow();
  });

  it('extracts activity contributions from effective module views', () => {
    const modules = buildViews(['owner']);
    const contributions = extractActivityContributions(modules);
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions.some((c) => c.activityKind === 'feed')).toBe(true);
  });

  it('builds registry snapshot with feeds and capabilities for owner', () => {
    const modules = buildViews(['owner']);
    const contributions = extractActivityContributions(modules);
    const included = STATIC_ACTIVITY_CATALOG.filter((entry) =>
      isCatalogActivityEntryIncluded(entry, modules, contributions),
    );
    expect(included.length).toBeGreaterThan(0);

    const snapshot = buildRegistryActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      modules,
      1,
      'active',
      IDENTITY,
    );

    expect(assertActivitySnapshotValid(snapshot), assertActivitySnapshotValid(snapshot).join('\n')).toEqual(
      [],
    );
    expect(snapshot.canViewActivity).toBe(true);
    expect(snapshot.feeds.length).toBeGreaterThan(0);
    expect(getSnapshotFeedById(snapshot, 'global')).toBeDefined();
  });

  it('restricted snapshot is fail-closed', () => {
    const snapshot = buildRestrictedActivitySnapshot(IDENTITY, 1, 'active');
    expect(snapshot.canViewActivity).toBe(false);
    expect(snapshot.activityTypes).toEqual([]);
    expect(snapshot.feeds).toEqual([]);
  });

  it('static snapshot includes permitted entries for owner', () => {
    const snapshot = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      IDENTITY,
      'static-only',
    );
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.activityTypes.length).toBeGreaterThan(0);
    expect(snapshot.feeds.length).toBe(7);
  });

  it('projects feed capabilities from snapshot only', () => {
    const snapshot = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      IDENTITY,
      'static-only',
    );
    const caps = resolveActivityCapabilities({
      activityTypes: snapshot.activityTypes,
      feeds: snapshot.feeds,
      hubs: snapshot.hubs,
    });
    expect(caps.canViewClinicalFeed).toBe(true);
    expect(caps.canViewMyFeed).toBe(true);
  });

  it('round-trips identity-scoped cache keys', () => {
    clearActivityCache();
    const snapshot = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      IDENTITY,
      'static-only',
    );
    const key = buildActivityCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      branchId: IDENTITY.branchId,
      catalogGeneration: null,
      entitlementVersion: null,
      activitySnapshotVersion: snapshot.activitySnapshotVersion,
      moduleCount: 0,
      source: 'static-only',
    });
    writeActivityCache(key, snapshot);
    expect(readActivityCache(key)?.activitySnapshotVersion).toBe(snapshot.activitySnapshotVersion);
    clearActivityCache();
  });

  it('read-model resolves dashboard widget config from snapshot', () => {
    const snapshot = buildStaticActivitySnapshot(
      ['owner'],
      STATIC_ACTIVITY_CATALOG,
      IDENTITY,
      'static-only',
    );
    const config = resolveActivityWidgetConfig(snapshot);
    expect(config.showWidget).toBe(true);
    expect(config.viewAllHref).toBe('/activity');
  });
});
