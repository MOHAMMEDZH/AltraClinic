import type { EffectiveModuleView } from '@booking/module-registry';
import type { BranchCatalogEntry } from './static-branch-catalog';
import type {
  BranchCapabilityFlags,
  BranchContributionView,
  BranchSurfaceSnapshot,
  EffectiveBranchView,
} from './branch-types';

interface BranchExtensionPayload {
  surfaceId?: string;
  localId?: string;
  moduleId?: string;
  surface?: string;
  categoryId?: string;
  configurationCategory?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  inheritanceMode?: string;
  adminResourceId?: string;
  adminAction?: 'view' | 'update' | 'manage';
  settingsPath?: string;
  deepLinkTemplate?: string;
  requiredFeature?: string;
  providerKey?: string;
  sortOrder?: number;
  descriptionKey?: string;
  userAccessible?: boolean;
}

export function extractBranchContributions(modules: EffectiveModuleView[]): BranchContributionView[] {
  const contributions: BranchContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'branch') continue;

      const payload = extension.payload as BranchExtensionPayload;
      if (!payload.surfaceId || !payload.surface || !payload.categoryId) continue;
      if (typeof payload.branchScoped !== 'boolean' || typeof payload.crossBranchAllowed !== 'boolean') {
        continue;
      }
      if (!payload.inheritanceMode || !payload.configurationCategory) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId,
        surfaceId: payload.surfaceId,
        localId: payload.localId ?? payload.surfaceId,
        surface: payload.surface,
        categoryId: payload.categoryId,
        configurationCategory: payload.configurationCategory,
        branchScoped: payload.branchScoped,
        crossBranchAllowed: payload.crossBranchAllowed,
        inheritanceMode: payload.inheritanceMode,
        adminResourceId: payload.adminResourceId ?? 'api.settings',
        adminAction: payload.adminAction ?? 'view',
        settingsPath: payload.settingsPath ?? payload.deepLinkTemplate ?? '',
        deepLinkTemplate: payload.deepLinkTemplate ?? payload.settingsPath ?? '',
        requiredFeature: payload.requiredFeature,
        labelKey: extension.labelKey,
        descriptionKey: payload.descriptionKey ?? extension.descriptionKey ?? extension.labelKey,
        providerKey: payload.providerKey ?? 'branch.builtin',
        sortOrder: payload.sortOrder ?? extension.sortOrder,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

function isExtensionAccessible(contribution: BranchContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function validateBranchOwnership(
  entry: BranchCatalogEntry,
  contribution: BranchContributionView | undefined,
): string | null {
  if (!contribution) return 'missing-contribution';
  if (contribution.moduleId !== entry.moduleId) return 'module-mismatch';
  if (contribution.surfaceId !== entry.surfaceId) return 'surfaceId-mismatch';
  if (contribution.configurationCategory !== entry.configurationCategory) {
    return 'configurationCategory-mismatch';
  }
  if (contribution.inheritanceMode !== entry.inheritanceMode) return 'inheritance-mismatch';
  if (contribution.crossBranchAllowed !== entry.crossBranchAllowed) return 'crossBranch-mismatch';
  if (contribution.providerKey !== entry.providerKey) return 'providerKey-mismatch';
  return null;
}

export function isCatalogBranchEntryIncluded(
  entry: BranchCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: BranchContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (validateBranchOwnership(entry, contribution)) return false;
  if (!isExtensionAccessible(contribution)) return false;

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}

export function isStaticBranchCatalogEntryIncluded(
  entry: BranchCatalogEntry,
  enabledFeatures: string[],
): boolean {
  if (!entry.requiredFeature) return true;
  return enabledFeatures.includes(entry.requiredFeature);
}

export function contributionToSurfaceSnapshot(
  contribution: BranchContributionView,
): BranchSurfaceSnapshot {
  return {
    surfaceId: contribution.surfaceId,
    extensionId: contribution.extensionId,
    moduleId: contribution.moduleId,
    localId: contribution.localId,
    surface: contribution.surface,
    categoryId: contribution.categoryId,
    configurationCategory: contribution.configurationCategory,
    branchScoped: contribution.branchScoped,
    crossBranchAllowed: contribution.crossBranchAllowed,
    inheritanceMode: contribution.inheritanceMode,
    adminResourceId: contribution.adminResourceId,
    adminAction: contribution.adminAction,
    settingsPath: contribution.settingsPath,
    deepLinkTemplate: contribution.deepLinkTemplate,
    requiredFeature: contribution.requiredFeature,
    labelKey: contribution.labelKey,
    descriptionKey: contribution.descriptionKey,
    providerKey: contribution.providerKey,
    sortOrder: contribution.sortOrder,
  };
}

export function catalogEntryToContributionView(entry: BranchCatalogEntry): BranchContributionView {
  return {
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    surfaceId: entry.surfaceId,
    localId: entry.localId,
    surface: entry.surface,
    categoryId: entry.categoryId,
    configurationCategory: entry.configurationCategory,
    branchScoped: entry.branchScoped,
    crossBranchAllowed: entry.crossBranchAllowed,
    inheritanceMode: entry.inheritanceMode,
    adminResourceId: entry.adminResourceId,
    adminAction: entry.adminAction,
    settingsPath: entry.settingsPath,
    deepLinkTemplate: entry.deepLinkTemplate,
    requiredFeature: entry.requiredFeature,
    labelKey: entry.labelKey,
    descriptionKey: entry.descriptionKey,
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
    userVisible: true,
    userAccessible: true,
  };
}

export function resolveBranchCapabilities(input: {
  accessibleSurfaces: BranchSurfaceSnapshot[];
  canSelectBranch: boolean;
  canViewCrossBranch: boolean;
  canManageBranches: boolean;
  accessibleBranchIds: string[];
}): BranchCapabilityFlags {
  const surfaces = input.accessibleSurfaces;
  const hasAccess = input.accessibleBranchIds.length > 0 || surfaces.length > 0;
  const hasCrossBranchSurface = surfaces.some(
    (surface) =>
      surface.crossBranchAllowed &&
      (surface.surfaceId === 'reporting-cross-branch' || surface.surfaceId === 'analytics-cross-branch'),
  );
  const hasManageSurface = surfaces.some(
    (surface) => surface.adminAction === 'update' || surface.adminAction === 'manage',
  );
  const hasBrandingSurface = surfaces.some((surface) => surface.categoryId === 'branch-white-label');

  return {
    canAccessBranch: hasAccess,
    canSwitchBranch: input.canSelectBranch && input.accessibleBranchIds.length > 1,
    canViewCrossBranch: input.canViewCrossBranch && hasCrossBranchSurface,
    canManageBranchSettings: input.canManageBranches && hasManageSurface,
    canUseBranchBranding: hasBrandingSurface,
  };
}

export function resolveBranchCapabilitiesFromSnapshot(snapshot: {
  capabilities: BranchCapabilityFlags;
}): BranchCapabilityFlags {
  return { ...snapshot.capabilities };
}

export function collectBranchProviderKeys(accessibleSurfaces: BranchSurfaceSnapshot[]): string[] {
  return [...new Set(accessibleSurfaces.map((surface) => surface.providerKey))].sort();
}

export function buildEffectiveBranchViewShell(
  partial: Omit<EffectiveBranchView, 'capabilities'> & { capabilities?: BranchCapabilityFlags },
): EffectiveBranchView {
  const capabilities =
    partial.capabilities ??
    resolveBranchCapabilities({
      accessibleSurfaces: partial.accessibleSurfaces,
      canSelectBranch: partial.canSelectBranch,
      canViewCrossBranch: partial.canViewCrossBranch,
      canManageBranches: partial.canManageBranches,
      accessibleBranchIds: partial.accessibleBranchIds,
    });

  return { ...partial, capabilities };
}
