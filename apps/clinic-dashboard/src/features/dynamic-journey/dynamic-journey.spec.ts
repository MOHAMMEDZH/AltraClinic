import { describe, expect, it, afterEach, vi } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  STATIC_JOURNEY_CATALOG,
  STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY,
} from './lib/static-journey-catalog';
import {
  buildJourneyCacheKey,
  clearJourneyCache,
  JOURNEY_CACHE_VERSION,
  readJourneyCache,
  readJourneyCacheForIdentity,
  writeJourneyCache,
} from './lib/journey-cache';
import { extractJourneyContributions, resolveAccessibleJourneyCatalog } from './lib/journey-resolver';
import {
  buildRegistryJourneySnapshot,
  buildRestrictedJourneySnapshot,
  buildStaticJourneySnapshot,
} from './lib/journey-snapshot-builder';
import { assertJourneyCatalogLoaded, assertJourneySnapshotValid } from './lib/journey-validation';
import { isRegistryJourneyEnabled } from './lib/journey-flags';
import { resolvePatientJourneyStripConfig } from './lib/journey-read-model';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
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

const IDENTITY = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  rolesHash: 'owner',
  branchId: 'branch-1' as string | null,
};

describe('dynamic journey runtime (Phase 40b)', () => {
  afterEach(() => {
    clearJourneyCache();
    vi.unstubAllEnvs();
  });

  it('keeps static catalog as non-authority', () => {
    expect(STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(() => assertJourneyCatalogLoaded()).not.toThrow();
  });

  it('extracts journey contributions from EffectiveModuleView only', () => {
    const views = buildViews(['owner']);
    const contributions = extractJourneyContributions(views);
    expect(contributions.length).toBe(STATIC_JOURNEY_CATALOG.length);
    expect(contributions.every((c) => c.journeyKind)).toBe(true);
  });

  it('joins catalog and validates stage/transition ownership', () => {
    const views = buildViews(['owner']);
    const contributions = extractJourneyContributions(views);
    const resolved = resolveAccessibleJourneyCatalog({
      catalog: STATIC_JOURNEY_CATALOG,
      identity: IDENTITY,
      modules: views,
      contributions,
    });
    expect(resolved.stages.length).toBeGreaterThan(0);
    expect(resolved.transitions.length).toBeGreaterThan(0);
    for (const transition of resolved.transitions) {
      expect(resolved.stageIds.has(transition.fromStageId!)).toBe(true);
      expect(resolved.stageIds.has(transition.toStageId!)).toBe(true);
    }
  });

  it('builds registry snapshot with capability projection', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    expect(assertJourneySnapshotValid(snapshot), assertJourneySnapshotValid(snapshot).join('\n')).toEqual([]);
    expect(snapshot.source).toBe('registry');
    expect(snapshot.stages.length).toBeGreaterThan(0);
    expect(snapshot.canViewJourney).toBe(true);
    expect(snapshot.capabilities.canViewJourney).toBe(snapshot.canViewJourney);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('builds static-only and static-fallback snapshots without widening', () => {
    const staticOnly = buildStaticJourneySnapshot(['owner'], STATIC_JOURNEY_CATALOG, IDENTITY, 'static-only');
    const staticFallback = buildStaticJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      IDENTITY,
      'static-fallback',
    );
    expect(staticOnly.source).toBe('static-only');
    expect(staticFallback.source).toBe('static-fallback');
    expect(assertJourneySnapshotValid(staticOnly)).toEqual([]);
    expect(assertJourneySnapshotValid(staticFallback)).toEqual([]);
    expect(staticOnly.stages.length).toBeLessThanOrEqual(STATIC_JOURNEY_CATALOG.filter((e) => e.journeyKind === 'stage').length);
  });

  it('builds restricted snapshot with all capabilities false', () => {
    const snapshot = buildRestrictedJourneySnapshot(IDENTITY, 1, 'active');
    expect(snapshot.source).toBe('restricted');
    expect(snapshot.stages).toEqual([]);
    expect(snapshot.transitions).toEqual([]);
    expect(snapshot.packs).toEqual([]);
    expect(snapshot.surfaces).toEqual([]);
    expect(Object.values(snapshot.capabilities).every((value) => value === false)).toBe(true);
    expect(assertJourneySnapshotValid(snapshot)).toEqual([]);
  });

  it('registry owner stages never exceed static catalog vocabulary', () => {
    const views = buildViews(['owner']);
    const registry = buildRegistryJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    const catalogStageIds = new Set(
      STATIC_JOURNEY_CATALOG.filter((e) => e.journeyKind === 'stage').map((e) => e.stageId),
    );
    for (const stage of registry.stages) {
      expect(catalogStageIds.has(stage.stageId)).toBe(true);
    }
  });

  it('identity cache includes branch key participation and clears without PHI', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    const key = buildJourneyCacheKey({
      tenantId: IDENTITY.tenantId,
      userId: IDENTITY.userId,
      rolesHash: IDENTITY.rolesHash,
      activeBranchId: IDENTITY.branchId,
      branchSnapshotVersion: 'bv1',
      catalogGeneration: 1,
      entitlementVersion: 'active',
      journeyConfigurationVersion: snapshot.journeyConfigurationVersion,
      journeySnapshotVersion: snapshot.journeySnapshotVersion,
      cacheVersion: JOURNEY_CACHE_VERSION,
      moduleCount: views.length,
      source: 'registry',
    });
    writeJourneyCache(key, snapshot);
    expect(readJourneyCache(key)?.journeySnapshotVersion).toBe(snapshot.journeySnapshotVersion);
    expect(
      readJourneyCacheForIdentity({
        tenantId: IDENTITY.tenantId,
        userId: IDENTITY.userId,
        rolesHash: IDENTITY.rolesHash,
        activeBranchId: IDENTITY.branchId,
        branchSnapshotVersion: 'bv1',
        catalogGeneration: 1,
        entitlementVersion: 'active',
        journeyConfigurationVersion: snapshot.journeyConfigurationVersion,
      })?.source,
    ).toBe('registry');
    expect(
      readJourneyCacheForIdentity({
        tenantId: IDENTITY.tenantId,
        userId: IDENTITY.userId,
        rolesHash: IDENTITY.rolesHash,
        activeBranchId: IDENTITY.branchId,
        branchSnapshotVersion: 'bv2',
        catalogGeneration: 1,
        entitlementVersion: 'active',
        journeyConfigurationVersion: snapshot.journeyConfigurationVersion,
      }),
    ).toBeNull();
    clearJourneyCache();
    expect(readJourneyCache(key)).toBeNull();
    expect(JSON.stringify(snapshot)).not.toMatch(/patientId|PHI|ssn|mrn/i);
  });

  it('patient strip config prefers provider snapshot', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryJourneySnapshot(
      ['owner'],
      STATIC_JOURNEY_CATALOG,
      views,
      1,
      'active',
      IDENTITY,
    );
    const config = resolvePatientJourneyStripConfig(snapshot);
    expect(config.showStrip).toBe(true);
    expect(config.surfaceId).toBe('patient-journey-strip');
    expect(config.activityLinkSurfaceId).toBe('activity-center');
    expect(config.auditLinkSurfaceId).toBe('audit-center');
  });

  it('enables registry journey by default', () => {
    expect(isRegistryJourneyEnabled()).toBe(true);
  });
});
