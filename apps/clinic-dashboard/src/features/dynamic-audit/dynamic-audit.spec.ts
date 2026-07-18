import { describe, expect, it, afterEach } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import { STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY } from '@booking/module-registry/audit';
import {
  AUDIT_CACHE_VERSION,
  buildAuditCacheKey,
  clearAuditCache,
  readAuditCache,
  writeAuditCache,
} from './lib/audit-cache';
import {
  extractAuditContributions,
  isCatalogAuditEntryIncluded,
} from './lib/audit-resolver';
import { resolveAuditCapabilities } from './lib/audit-capabilities';
import {
  buildRegistryAuditSnapshot,
  buildRestrictedAuditSnapshot,
  buildStaticAuditSnapshot,
  getSnapshotFeedById,
  getSnapshotSurfaceById,
} from './lib/audit-snapshot-builder';
import { STATIC_AUDIT_CATALOG } from './lib/static-audit-catalog';
import {
  assertAuditCatalogLoaded,
  assertAuditSnapshotValid,
} from './lib/audit-validation';
import { resolveAuditCenterConfig } from './lib/audit-read-model';

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

describe('dynamic audit resolver & snapshot', () => {
  afterEach(() => {
    clearAuditCache();
  });

  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('loads catalog at bootstrap without errors', () => {
    expect(() => assertAuditCatalogLoaded()).not.toThrow();
  });

  it('extracts audit contributions from effective module views', () => {
    const modules = buildViews(['owner']);
    const contributions = extractAuditContributions(modules);
    expect(contributions.length).toBeGreaterThan(0);
    expect(contributions.some((c) => c.auditKind === 'feed')).toBe(true);
    expect(contributions.some((c) => c.auditKind === 'type')).toBe(true);
  });

  it('builds registry snapshot with feeds and capabilities for owner', () => {
    const modules = buildViews(['owner']);
    const contributions = extractAuditContributions(modules);
    const included = STATIC_AUDIT_CATALOG.filter((entry) =>
      isCatalogAuditEntryIncluded(entry, modules, contributions),
    );
    expect(included.length).toBeGreaterThan(0);

    const snapshot = buildRegistryAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      modules,
      1,
      'active',
      IDENTITY,
    );

    expect(assertAuditSnapshotValid(snapshot), assertAuditSnapshotValid(snapshot).join('\n')).toEqual([]);
    expect(snapshot.canViewAuditCenter).toBe(true);
    expect(snapshot.feeds.length).toBeGreaterThan(0);
    expect(getSnapshotFeedById(snapshot, 'all-authorized')).toBeDefined();
    expect(getSnapshotSurfaceById(snapshot, 'audit-center')).toBeDefined();
    expect(snapshot.policies.length).toBeGreaterThan(0);
  });

  it('restricted snapshot is fail-closed', () => {
    const snapshot = buildRestrictedAuditSnapshot(IDENTITY, 1, 'active');
    expect(snapshot.source).toBe('restricted');
    expect(snapshot.canViewAuditCenter).toBe(false);
    expect(snapshot.eventTypes).toEqual([]);
    expect(snapshot.feeds).toEqual([]);
    expect(snapshot.surfaces).toEqual([]);
    expect(assertAuditSnapshotValid(snapshot)).toEqual([]);
  });

  it('static snapshot includes permitted entries for owner', () => {
    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.eventTypes.length).toBeGreaterThan(0);
    expect(snapshot.feeds.length).toBeGreaterThanOrEqual(12);
    expect(snapshot.surfaces.length).toBeGreaterThanOrEqual(3);
    expect(getSnapshotFeedById(snapshot, 'all-authorized')).toBeDefined();
  });

  it('projects capabilities from snapshot only', () => {
    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );
    const caps = resolveAuditCapabilities({
      eventTypes: snapshot.eventTypes,
      feeds: snapshot.feeds,
      surfaces: snapshot.surfaces,
    });
    expect(caps.canViewSecurityAudit).toBe(true);
    expect(caps.canViewClinicalAudit).toBe(true);
    expect(caps.canViewAuditCenter).toBe(true);
  });

  it('round-trips identity-scoped configuration cache keys', () => {
    clearAuditCache();
    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );
    const key = buildAuditCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      branchId: IDENTITY.branchId,
      branchSnapshotVersion: null,
      catalogGeneration: null,
      entitlementVersion: null,
      auditSnapshotVersion: snapshot.auditSnapshotVersion,
      cacheVersion: AUDIT_CACHE_VERSION,
      moduleCount: 0,
      source: 'static-only',
    });
    writeAuditCache(key, snapshot);
    expect(readAuditCache(key)?.auditSnapshotVersion).toBe(snapshot.auditSnapshotVersion);
    clearAuditCache();
  });

  it('read-model resolves audit center config from snapshot', () => {
    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );
    const config = resolveAuditCenterConfig(snapshot);
    expect(config.showAuditCenter).toBe(true);
    expect(config.centerHref).toBe('/settings/audit');
  });

  it('refresh invalidation clears configuration cache only', () => {
    const snapshot = buildStaticAuditSnapshot(
      ['owner'],
      STATIC_AUDIT_CATALOG,
      IDENTITY,
      'static-only',
    );
    const key = buildAuditCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      branchId: IDENTITY.branchId,
      branchSnapshotVersion: 'v1',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      auditSnapshotVersion: snapshot.auditSnapshotVersion,
      cacheVersion: AUDIT_CACHE_VERSION,
      moduleCount: 1,
      source: 'registry',
    });
    writeAuditCache(key, snapshot);
    expect(readAuditCache(key)).not.toBeNull();
    clearAuditCache();
    expect(readAuditCache(key)).toBeNull();
  });
});
