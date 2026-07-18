import { afterEach, describe, expect, it } from 'vitest';
import {
  BUILTIN_MODULE_MANIFESTS,
  resolveDependencyGraph,
  resolveEffectiveModuleViews,
} from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import {
  buildBranchCacheKey,
  clearBranchCache,
  readBranchCache,
  readBranchCacheForIdentity,
  writeBranchCache,
} from './lib/branch-cache';
import {
  extractBranchContributions,
  isCatalogBranchEntryIncluded,
  resolveBranchCapabilities,
} from './lib/branch-resolver';
import {
  buildRegistryBranchSnapshot,
  buildRestrictedBranchSnapshot,
  buildStaticBranchSnapshot,
} from './lib/branch-snapshot-builder';
import { resolveActiveBranchId } from './lib/branch-access';
import { STATIC_BRANCH_CATALOG } from './lib/static-branch-catalog';
import { assertBranchCatalogValid, assertBranchSnapshotValid } from './lib/branch-validation';
import { defaultBranchReadModel } from './lib/branch-read-model';
import { getBranchWhiteLabelProjection } from './lib/branch-white-label-projection';
import { clearActiveBranchSession, writeActiveBranchSession } from './lib/branch-session';

const ALL_ENABLED = Object.fromEntries(
  BUILTIN_MODULE_MANIFESTS.map((manifest) => [manifest.moduleId, 'enabled' as const]),
);

const IDENTITY = {
  tenantId: 'tenant-1',
  userId: 'user-1',
  rolesHash: 'owner',
  locale: 'en-US',
  activeBranchId: null as string | null,
  primaryBranchId: 'branch-1' as string | null,
};

const BRANCHES = [
  { id: 'branch-1', name: 'Main', nameAr: null, isActive: true },
  { id: 'branch-2', name: 'East', nameAr: null, isActive: true },
];

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

afterEach(() => {
  clearBranchCache();
  clearActiveBranchSession();
});

describe('branch catalog', () => {
  it('validates catalog integrity', () => {
    expect(assertBranchCatalogValid(), assertBranchCatalogValid().join('\n')).toEqual([]);
  });
});

describe('branch resolver', () => {
  it('extracts branch contributions from effective views only', () => {
    const views = buildViews(['owner']);
    const contributions = extractBranchContributions(views);
    expect(contributions.length).toBe(24);
    expect(contributions.every((entry) => entry.extensionId.includes('/branch/'))).toBe(true);
  });

  it('gates catalog entries by extension-level accessibility', () => {
    const ownerViews = buildViews(['owner']);
    const receptionistViews = buildViews(['receptionist']);
    const ownerContributions = extractBranchContributions(ownerViews);
    const receptionistContributions = extractBranchContributions(receptionistViews);
    const entry = STATIC_BRANCH_CATALOG.find((item) => item.surfaceId === 'settings-branch-create')!;
    expect(isCatalogBranchEntryIncluded(entry, ownerViews, ownerContributions)).toBe(true);
    expect(isCatalogBranchEntryIncluded(entry, receptionistViews, receptionistContributions)).toBe(
      false,
    );
  });

  it('derives aggregate capabilities from accessible surfaces and access context', () => {
    const snapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: BRANCHES,
        sessionBranchId: null,
      },
      IDENTITY,
      ['owner'],
      'static-only',
    );
    const capabilities = resolveBranchCapabilities({
      accessibleSurfaces: snapshot.entries,
      canSelectBranch: true,
      canViewCrossBranch: true,
      canManageBranches: true,
      accessibleBranchIds: snapshot.accessibleBranchIds,
    });
    expect(capabilities.canAccessBranch).toBe(true);
    expect(capabilities.canSwitchBranch).toBe(true);
    expect(capabilities.canViewCrossBranch).toBe(true);
    expect(capabilities.canManageBranchSettings).toBe(true);
    expect(capabilities.canUseBranchBranding).toBe(true);
  });
});

describe('active branch resolution', () => {
  it('restores session branch when still accessible', () => {
    expect(
      resolveActiveBranchId({
        sessionBranchId: 'branch-2',
        primaryBranchId: 'branch-1',
        accessibleBranchIds: ['branch-1', 'branch-2'],
        branches: BRANCHES,
        canViewCrossBranch: true,
        branchAccessMode: 'multi',
      }),
    ).toBe('branch-2');
  });

  it('recovers unavailable session branch to primary', () => {
    expect(
      resolveActiveBranchId({
        sessionBranchId: 'archived',
        primaryBranchId: 'branch-1',
        accessibleBranchIds: ['branch-1', 'branch-2'],
        branches: BRANCHES,
        canViewCrossBranch: true,
        branchAccessMode: 'multi',
      }),
    ).toBe('branch-1');
  });

  it('returns null for global cross-branch when no single-branch fallback', () => {
    expect(
      resolveActiveBranchId({
        sessionBranchId: null,
        primaryBranchId: null,
        accessibleBranchIds: ['branch-1', 'branch-2'],
        branches: BRANCHES,
        canViewCrossBranch: true,
        branchAccessMode: 'global',
      }),
    ).toBeNull();
  });
});

describe('branch snapshot builder', () => {
  it('builds registry snapshot with catalog join', () => {
    const views = buildViews(['owner']);
    const snapshot = buildRegistryBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      views,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: BRANCHES,
        sessionBranchId: 'branch-1',
      },
      3,
      'ent-1',
      IDENTITY,
      ['owner'],
    );
    expect(snapshot.source).toBe('registry');
    expect(snapshot.entries.length).toBeGreaterThan(0);
    expect(assertBranchSnapshotValid(snapshot)).toEqual([]);
    expect(getBranchWhiteLabelProjection(snapshot)?.displayName).toBe('Main');
  });

  it('builds restricted snapshot with no surfaces and fail-closed capabilities', () => {
    const snapshot = buildRestrictedBranchSnapshot(IDENTITY, ['receptionist'], null, null);
    expect(snapshot.source).toBe('restricted');
    expect(snapshot.entries).toEqual([]);
    expect(snapshot.capabilities.canSwitchBranch).toBe(false);
    expect(snapshot.capabilities.canViewCrossBranch).toBe(false);
    expect(assertBranchSnapshotValid(snapshot)).toEqual([]);
  });

  it('builds static-only snapshot for rollback', () => {
    const snapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: BRANCHES,
        sessionBranchId: null,
      },
      IDENTITY,
      ['owner'],
      'static-only',
    );
    expect(snapshot.source).toBe('static-only');
    expect(snapshot.registryMode).toBe(false);
    expect(snapshot.entries.length).toBe(24);
  });
});

describe('branch cache', () => {
  it('reads and writes identity-scoped cache keys', () => {
    const snapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: BRANCHES,
        sessionBranchId: 'branch-1',
      },
      { ...IDENTITY, activeBranchId: 'branch-1' },
      ['owner'],
      'static-only',
    );
    const key = buildBranchCacheKey({
      tenantId: 'tenant-1',
      userId: 'user-1',
      rolesHash: 'owner',
      activeBranchId: 'branch-1',
      catalogGeneration: 1,
      entitlementVersion: 'e1',
      settingsVersion: 's1',
      source: 'registry',
      moduleCount: 21,
    });
    writeBranchCache(key, { ...snapshot, source: 'registry' });
    expect(readBranchCache(key)?.activeBranchId).toBe('branch-1');
    expect(
      readBranchCacheForIdentity({
        tenantId: 'tenant-1',
        userId: 'user-1',
        rolesHash: 'owner',
        activeBranchId: 'branch-1',
        catalogGeneration: 1,
        entitlementVersion: 'e1',
        settingsVersion: 's1',
      })?.activeBranchId,
    ).toBe('branch-1');
    clearBranchCache();
    expect(readBranchCache(key)).toBeNull();
  });

  it('persists session selection for active branch authority', () => {
    writeActiveBranchSession('branch-2');
    const snapshot = buildStaticBranchSnapshot(
      STATIC_BRANCH_CATALOG,
      defaultBranchReadModel('tenant-1'),
      {
        roles: ['owner'],
        primaryBranchId: 'branch-1',
        branches: BRANCHES,
        sessionBranchId: 'branch-2',
      },
      IDENTITY,
      ['owner'],
      'static-fallback',
    );
    expect(snapshot.activeBranchId).toBe('branch-2');
  });
});
