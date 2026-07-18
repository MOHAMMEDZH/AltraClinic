import type { EffectiveModuleView } from '@booking/module-registry';
import type {
  WhiteLabelCapabilities,
  WhiteLabelContributionView,
  WhiteLabelSurfaceSnapshot,
} from './white-label-types';
import type { WhiteLabelCatalogEntry } from './static-white-label-catalog';

interface WhiteLabelExtensionPayload {
  surfaceId?: string;
  localId?: string;
  moduleId?: string;
  surface?: string;
  categoryId?: string;
  requiredFeature?: string;
  settingsPath?: string;
  deepLinkTemplate?: string;
  adminResourceId?: string;
  adminAction?: 'view' | 'update';
  appliesTo?: string[];
  assetSlots?: string[];
  tokenGroups?: string[];
  layoutProfileId?: string;
  localizationOptionIds?: string[];
  defaultEnabled?: boolean;
  rollbackBehavior?: 'platform' | 'tenant-json';
  providerKey?: string;
  schemaVersion?: number;
  userAccessible?: boolean;
}

export function extractWhiteLabelContributions(
  modules: EffectiveModuleView[],
): WhiteLabelContributionView[] {
  const contributions: WhiteLabelContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'whiteLabel') continue;

      const payload = extension.payload as WhiteLabelExtensionPayload;
      if (!payload.surfaceId || !payload.surface || !payload.requiredFeature) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId,
        surfaceId: payload.surfaceId,
        localId: payload.localId ?? payload.surfaceId,
        surface: payload.surface,
        categoryId: payload.categoryId ?? 'core-branding',
        requiredFeature: payload.requiredFeature,
        settingsPath: payload.settingsPath ?? payload.deepLinkTemplate ?? '',
        deepLinkTemplate: payload.deepLinkTemplate ?? payload.settingsPath ?? '',
        adminResourceId: payload.adminResourceId ?? 'api.settings',
        adminAction: payload.adminAction ?? 'update',
        appliesTo: payload.appliesTo ?? [],
        assetSlots: payload.assetSlots ?? [],
        tokenGroups: payload.tokenGroups ?? [],
        layoutProfileId: payload.layoutProfileId,
        localizationOptionIds: payload.localizationOptionIds ?? [],
        defaultEnabled: payload.defaultEnabled ?? true,
        rollbackBehavior: payload.rollbackBehavior ?? 'tenant-json',
        labelKey: extension.labelKey,
        descriptionKey: extension.descriptionKey ?? extension.labelKey,
        providerKey: payload.providerKey ?? 'whitelabel.builtin',
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

function isExtensionAccessible(contribution: WhiteLabelContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function isCatalogWhiteLabelEntryIncluded(
  entry: WhiteLabelCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: WhiteLabelContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}

export function isStaticCatalogEntryIncluded(
  entry: WhiteLabelCatalogEntry,
  enabledFeatures: string[],
): boolean {
  return enabledFeatures.includes(entry.requiredFeature);
}

export function contributionToSurfaceSnapshot(
  contribution: WhiteLabelContributionView,
): WhiteLabelSurfaceSnapshot {
  return {
    surfaceId: contribution.surfaceId,
    extensionId: contribution.extensionId,
    moduleId: contribution.moduleId,
    localId: contribution.localId,
    surface: contribution.surface,
    categoryId: contribution.categoryId,
    requiredFeature: contribution.requiredFeature,
    deepLinkTemplate: contribution.deepLinkTemplate,
    settingsPath: contribution.settingsPath,
    assetSlots: [...contribution.assetSlots],
    tokenGroups: [...contribution.tokenGroups],
    layoutProfileId: contribution.layoutProfileId,
    localizationOptionIds: [...contribution.localizationOptionIds],
    defaultEnabled: contribution.defaultEnabled,
    labelKey: contribution.labelKey,
    descriptionKey: contribution.descriptionKey,
    sortOrder: contribution.sortOrder,
  };
}

export function resolveWhiteLabelCapabilities(view: {
  accessibleSurfaces: WhiteLabelSurfaceSnapshot[];
  brandingEnabled: boolean;
  whiteLabelEnabled: boolean;
}): WhiteLabelCapabilities {
  const surfaces = new Set(view.accessibleSurfaces.map((surface) => surface.surface));

  return {
    canCustomizeBranding:
      view.brandingEnabled &&
      (surfaces.has('branding') || view.accessibleSurfaces.some((s) => s.categoryId === 'core-branding')),
    canCustomizeTheme: view.whiteLabelEnabled && surfaces.has('theme'),
    canCustomizeLayout: view.whiteLabelEnabled && surfaces.has('layout'),
    canCustomizeLocalization: view.whiteLabelEnabled && surfaces.has('localization'),
    canUseCustomDomain: view.whiteLabelEnabled && surfaces.has('customDomain'),
  };
}

export function resolveWhiteLabelCapabilitiesFromSnapshot(snapshot: {
  capabilities: WhiteLabelCapabilities;
}): WhiteLabelCapabilities {
  return snapshot.capabilities;
}

export function collectEnabledFeatures(accessibleSurfaces: WhiteLabelSurfaceSnapshot[]): string[] {
  const features = new Set<string>();
  for (const surface of accessibleSurfaces) {
    features.add(surface.requiredFeature);
  }
  return [...features].sort();
}

export function collectProviderKeys(accessibleSurfaces: WhiteLabelSurfaceSnapshot[]): string[] {
  const keys = new Set<string>();
  for (const surface of accessibleSurfaces) {
    keys.add('whitelabel.builtin');
  }
  return [...keys].sort();
}
