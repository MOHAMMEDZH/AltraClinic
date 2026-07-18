import type { EffectiveModuleView } from '@booking/module-registry';
import {
  buildAccessibleBranchIds,
  canManageBranchesFromRoles,
  canSelectBranchFromRoles,
  canViewCrossBranchFromRoles,
  resolveActiveBranchId,
  resolveBranchAccessMode,
} from './branch-access';
import {
  hashBranchSettingsVersion,
  hashStaticCatalog,
  mergeBranchConfiguration,
  toBranchDetail,
} from './branch-merge';
import {
  catalogEntryToContributionView,
  contributionToSurfaceSnapshot,
  extractBranchContributions,
  isCatalogBranchEntryIncluded,
  isStaticBranchCatalogEntryIncluded,
  resolveBranchCapabilities,
} from './branch-resolver';
import type { BranchCatalogEntry } from './static-branch-catalog';
import type {
  BranchAccessContext,
  BranchResolutionSource,
  BranchSettingsReadModel,
  BranchSnapshot,
  BranchSnapshotIdentity,
  BranchSurfaceSnapshot,
  EffectiveBranchView,
  LockedBranchSurface,
} from './branch-types';
import { EMPTY_BRANCH_CAPABILITIES } from './branch-types';

export interface BuildBranchSnapshotOptions {
  catalog: readonly BranchCatalogEntry[];
  modules: EffectiveModuleView[];
  readModel: BranchSettingsReadModel;
  access: BranchAccessContext;
  source: BranchResolutionSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: BranchSnapshotIdentity;
  includeAllPermitted?: boolean;
  roles: string[];
}

function filterAccessibleSurfaces(options: BuildBranchSnapshotOptions): {
  accessibleSurfaces: BranchSurfaceSnapshot[];
  lockedSurfaces: LockedBranchSurface[];
} {
  const contributions = extractBranchContributions(options.modules);
  const accessibleSurfaces: BranchSurfaceSnapshot[] = [];
  const lockedSurfaces: LockedBranchSurface[] = [];

  for (const entry of options.catalog) {
    if (options.includeAllPermitted) {
      const enabledFeatures = [
        ...new Set(
          options.catalog
            .map((item) => item.requiredFeature)
            .filter((feature): feature is string => Boolean(feature)),
        ),
        'customBranding',
        'whiteLabel',
        'analytics',
        'reports',
      ];
      if (!isStaticBranchCatalogEntryIncluded(entry, enabledFeatures)) {
        lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'licensing' });
        continue;
      }
      const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
      accessibleSurfaces.push(
        contributionToSurfaceSnapshot(contribution ?? catalogEntryToContributionView(entry)),
      );
      continue;
    }

    if (!isCatalogBranchEntryIncluded(entry, options.modules, contributions)) {
      lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'registry' });
      continue;
    }

    const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
    if (!contribution) {
      lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'ownership' });
      continue;
    }

    accessibleSurfaces.push(contributionToSurfaceSnapshot(contribution));
  }

  return {
    accessibleSurfaces: accessibleSurfaces.sort(
      (a, b) => a.sortOrder - b.sortOrder || a.surfaceId.localeCompare(b.surfaceId),
    ),
    lockedSurfaces,
  };
}

function buildView(options: BuildBranchSnapshotOptions): EffectiveBranchView {
  const { accessibleSurfaces, lockedSurfaces } = filterAccessibleSurfaces(options);
  const canSelectBranch = canSelectBranchFromRoles(options.roles);
  const canViewCrossBranch = canViewCrossBranchFromRoles(options.roles);
  const canManageBranches = canManageBranchesFromRoles(options.roles);
  const branchAccessMode = resolveBranchAccessMode(options.roles);
  const accessibleBranchIds = buildAccessibleBranchIds(
    options.roles,
    options.access.primaryBranchId,
    options.access.branches,
  );

  const activeBranchId = resolveActiveBranchId({
    sessionBranchId: options.access.sessionBranchId,
    primaryBranchId: options.access.primaryBranchId,
    accessibleBranchIds,
    branches: options.access.branches,
    canViewCrossBranch,
    branchAccessMode,
  });

  const activeSummary = options.access.branches.find((branch) => branch.id === activeBranchId);
  const activeBranch = toBranchDetail(activeSummary, activeBranchId);
  const capabilities = resolveBranchCapabilities({
    accessibleSurfaces,
    canSelectBranch,
    canViewCrossBranch,
    canManageBranches,
    accessibleBranchIds,
  });

  const configuration = mergeBranchConfiguration({
    readModel: options.readModel,
    activeBranch,
    crossBranchAllowed: capabilities.canViewCrossBranch,
  });

  const settingsVersion = hashBranchSettingsVersion({
    tenantId: options.identity.tenantId,
    activeBranchId,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    branchCount: options.access.branches.length,
  });

  const branchSnapshotVersion = [
    settingsVersion,
    options.source,
    accessibleSurfaces.length,
    lockedSurfaces.length,
  ].join('#');

  return {
    tenantId: options.identity.tenantId,
    organizationProfileId: options.identity.tenantId,
    regionId: null,
    branchId: activeBranchId,
    userId: options.identity.userId,
    locale: options.identity.locale,
    departmentId: null,
    branchAccessMode,
    accessibleBranchIds,
    primaryBranchId: options.access.primaryBranchId,
    canSelectBranch,
    canViewCrossBranch,
    canManageBranches,
    branches: options.access.branches.filter((branch) => accessibleBranchIds.includes(branch.id)),
    activeBranch,
    accessibleSurfaces,
    lockedSurfaces,
    configuration,
    capabilities,
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    settingsVersion,
    branchSnapshotVersion,
    resolvedAt: new Date().toISOString(),
  };
}

export function buildBranchSnapshot(options: BuildBranchSnapshotOptions): BranchSnapshot {
  const view = buildView(options);
  return {
    kind: 'branch',
    view,
    source: options.source,
    registryMode: options.source === 'registry',
    staticCatalogHash: hashStaticCatalog([...options.catalog]),
    entitlementVersion: options.entitlementVersion,
    catalogGeneration: options.catalogGeneration,
    settingsVersion: view.settingsVersion ?? '0',
    branchSnapshotVersion: view.branchSnapshotVersion,
    capabilities: view.capabilities,
    entries: view.accessibleSurfaces,
    activeBranchId: view.branchId,
    accessibleBranchIds: view.accessibleBranchIds,
    identity: {
      ...options.identity,
      activeBranchId: view.branchId,
    },
  };
}

export function buildRegistryBranchSnapshot(
  catalog: readonly BranchCatalogEntry[],
  modules: EffectiveModuleView[],
  readModel: BranchSettingsReadModel,
  access: BranchAccessContext,
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: BranchSnapshotIdentity,
  roles: string[],
): BranchSnapshot {
  return buildBranchSnapshot({
    catalog,
    modules,
    readModel,
    access,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    includeAllPermitted: false,
    roles,
  });
}

export function buildStaticBranchSnapshot(
  catalog: readonly BranchCatalogEntry[],
  readModel: BranchSettingsReadModel,
  access: BranchAccessContext,
  identity: BranchSnapshotIdentity,
  roles: string[],
  source: 'static-only' | 'static-fallback',
): BranchSnapshot {
  return buildBranchSnapshot({
    catalog,
    modules: [],
    readModel,
    access,
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    includeAllPermitted: true,
    roles,
  });
}

export function buildRestrictedBranchSnapshot(
  identity: BranchSnapshotIdentity,
  roles: string[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): BranchSnapshot {
  const primary = identity.primaryBranchId;
  const accessibleBranchIds = primary ? [primary] : [];
  const settingsVersion = hashBranchSettingsVersion({
    tenantId: identity.tenantId,
    activeBranchId: primary,
    catalogGeneration,
    entitlementVersion,
    branchCount: accessibleBranchIds.length,
  });
  const branchSnapshotVersion = `${settingsVersion}#restricted#0#0`;
  const activeBranch = toBranchDetail(undefined, primary);

  const view: EffectiveBranchView = {
    tenantId: identity.tenantId,
    organizationProfileId: identity.tenantId,
    regionId: null,
    branchId: primary,
    userId: identity.userId,
    locale: identity.locale,
    departmentId: null,
    branchAccessMode: 'single',
    accessibleBranchIds,
    primaryBranchId: primary,
    canSelectBranch: false,
    canViewCrossBranch: false,
    canManageBranches: false,
    branches: activeBranch
      ? [
          {
            id: activeBranch.id,
            name: activeBranch.name,
            nameAr: activeBranch.nameAr,
            isActive: true,
          },
        ]
      : [],
    activeBranch,
    accessibleSurfaces: [],
    lockedSurfaces: [],
    configuration: mergeBranchConfiguration({
      readModel: {
        tenantId: identity.tenantId,
        locale: identity.locale,
        timezone: 'UTC',
        tenantName: 'Clinic',
        clinicProfile: {},
        settingsVersion: '0',
      },
      activeBranch,
      crossBranchAllowed: false,
    }),
    capabilities: {
      ...EMPTY_BRANCH_CAPABILITIES,
      canAccessBranch: accessibleBranchIds.length > 0,
    },
    source: 'restricted',
    catalogGeneration,
    settingsVersion,
    branchSnapshotVersion,
    resolvedAt: new Date().toISOString(),
  };

  return {
    kind: 'branch',
    view,
    source: 'restricted',
    registryMode: true,
    staticCatalogHash: 'restricted',
    entitlementVersion,
    catalogGeneration,
    settingsVersion,
    branchSnapshotVersion,
    capabilities: view.capabilities,
    entries: [],
    activeBranchId: view.branchId,
    accessibleBranchIds,
    identity: { ...identity, activeBranchId: view.branchId },
  };
}

export function getSnapshotSurfaceById(
  snapshot: BranchSnapshot,
  surfaceId: string,
): BranchSurfaceSnapshot | undefined {
  return snapshot.entries.find((entry) => entry.surfaceId === surfaceId);
}
