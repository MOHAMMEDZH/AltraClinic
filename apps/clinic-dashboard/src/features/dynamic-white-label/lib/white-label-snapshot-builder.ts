import type { LicensedModuleId } from '@booking/module-registry';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { ThemeMode } from '@/lib/theme';
import {
  collectEnabledFeatures,
  collectProviderKeys,
  contributionToSurfaceSnapshot,
  extractWhiteLabelContributions,
  isCatalogWhiteLabelEntryIncluded,
  isStaticCatalogEntryIncluded,
  resolveWhiteLabelCapabilities,
} from './white-label-resolver';
import {
  defaultTenantReadModel,
  hashBrandingGeneration,
  mergeEffectiveWhiteLabelView,
  type MergeEffectiveWhiteLabelViewInput,
} from './white-label-merge';
import type { WhiteLabelCatalogEntry } from './static-white-label-catalog';
import type {
  EffectiveWhiteLabelSnapshot,
  TenantBrandingSettingsReadModel,
  WhiteLabelResolutionSource,
  WhiteLabelSnapshot,
  WhiteLabelSnapshotIdentity,
  WhiteLabelSurfaceSnapshot,
} from './white-label-types';

export interface BuildWhiteLabelSnapshotOptions {
  catalog: readonly WhiteLabelCatalogEntry[];
  modules: EffectiveModuleView[];
  readModel: TenantBrandingSettingsReadModel;
  source: WhiteLabelResolutionSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: WhiteLabelSnapshotIdentity;
  userThemeMode: ThemeMode;
  includeAllPermitted?: boolean;
}

function filterAccessibleSurfaces(options: BuildWhiteLabelSnapshotOptions): {
  accessibleSurfaces: WhiteLabelSurfaceSnapshot[];
  lockedSurfaces: EffectiveWhiteLabelSnapshot['view']['lockedSurfaces'];
} {
  const contributions = extractWhiteLabelContributions(options.modules);
  const accessibleSurfaces: WhiteLabelSurfaceSnapshot[] = [];
  const lockedSurfaces: EffectiveWhiteLabelSnapshot['view']['lockedSurfaces'] = [];

  for (const entry of options.catalog) {
    if (options.includeAllPermitted) {
      if (!isStaticCatalogEntryIncluded(entry, options.readModel.enabledFeatures)) {
        lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'licensing' });
        continue;
      }
      const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
      accessibleSurfaces.push(
        contributionToSurfaceSnapshot(
          contribution ?? {
            extensionId: entry.extensionId,
            moduleId: entry.moduleId as LicensedModuleId,
            surfaceId: entry.surfaceId,
            localId: entry.localId,
            surface: entry.surface,
            categoryId: entry.categoryId,
            requiredFeature: entry.requiredFeature,
            settingsPath: entry.settingsPath,
            deepLinkTemplate: entry.deepLinkTemplate,
            adminResourceId: entry.adminResourceId,
            adminAction: entry.adminAction,
            appliesTo: entry.appliesTo,
            assetSlots: entry.assetSlots,
            tokenGroups: entry.tokenGroups,
            layoutProfileId: entry.layoutProfileId,
            localizationOptionIds: entry.localizationOptionIds,
            defaultEnabled: entry.defaultEnabled,
            rollbackBehavior: entry.rollbackBehavior,
            labelKey: entry.labelKey,
            descriptionKey: entry.descriptionKey,
            providerKey: entry.providerKey,
            sortOrder: entry.sortOrder,
            userVisible: true,
            userAccessible: true,
          },
        ),
      );
      continue;
    }

    if (!isCatalogWhiteLabelEntryIncluded(entry, options.modules, contributions)) {
      lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'registry' });
      continue;
    }

    const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
    if (!contribution) {
      lockedSurfaces.push({ surfaceId: entry.surfaceId, reason: 'registry' });
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

function buildView(
  options: BuildWhiteLabelSnapshotOptions,
  accessibleSurfaces: WhiteLabelSurfaceSnapshot[],
  lockedSurfaces: EffectiveWhiteLabelSnapshot['view']['lockedSurfaces'],
): EffectiveWhiteLabelSnapshot['view'] {
  const mergeInput: MergeEffectiveWhiteLabelViewInput = {
    readModel: options.readModel,
    accessibleSurfaces,
    lockedSurfaces,
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    locale: options.identity.locale,
    userThemeMode: options.userThemeMode,
    branchId: options.identity.branchId,
  };

  return mergeEffectiveWhiteLabelView(mergeInput);
}

function toEffectiveSnapshot(
  view: EffectiveWhiteLabelSnapshot['view'],
  brandingGeneration: string,
): EffectiveWhiteLabelSnapshot {
  const capabilities = resolveWhiteLabelCapabilities(view);

  return {
    kind: 'effective',
    view,
    assets: view.assets,
    theme: view.theme,
    layout: view.layout,
    localization: view.localization,
    capabilities,
    settingsVersion: view.settingsVersion ?? brandingGeneration,
    assetGeneration: view.assetGeneration ?? 0,
    brandingGeneration,
  };
}

export function buildWhiteLabelSnapshot(options: BuildWhiteLabelSnapshotOptions): WhiteLabelSnapshot {
  const { accessibleSurfaces, lockedSurfaces } = filterAccessibleSurfaces(options);
  const view = buildView(options, accessibleSurfaces, lockedSurfaces);
  const brandingGeneration = hashBrandingGeneration(options.readModel.branding);
  const effective = toEffectiveSnapshot(view, brandingGeneration);

  return {
    ...effective,
    source: options.source,
    identity: options.identity,
    entries: accessibleSurfaces,
    enabledFeatures: collectEnabledFeatures(accessibleSurfaces),
    providerKeys: collectProviderKeys(accessibleSurfaces),
  };
}

export function buildRegistryWhiteLabelSnapshot(
  catalog: readonly WhiteLabelCatalogEntry[],
  modules: EffectiveModuleView[],
  readModel: TenantBrandingSettingsReadModel,
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: WhiteLabelSnapshotIdentity,
  userThemeMode: ThemeMode,
): WhiteLabelSnapshot {
  return buildWhiteLabelSnapshot({
    catalog,
    modules,
    readModel,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    userThemeMode,
    includeAllPermitted: false,
  });
}

export function buildStaticWhiteLabelSnapshot(
  catalog: readonly WhiteLabelCatalogEntry[],
  readModel: TenantBrandingSettingsReadModel,
  identity: WhiteLabelSnapshotIdentity,
  userThemeMode: ThemeMode,
  source: 'static-only' | 'static-fallback',
): WhiteLabelSnapshot {
  return buildWhiteLabelSnapshot({
    catalog,
    modules: [],
    readModel,
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    userThemeMode,
    includeAllPermitted: true,
  });
}

export function buildRestrictedWhiteLabelSnapshot(
  identity: WhiteLabelSnapshotIdentity,
  userThemeMode: ThemeMode,
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): WhiteLabelSnapshot {
  const readModel = defaultTenantReadModel(identity.tenantId, identity.locale);

  return buildWhiteLabelSnapshot({
    catalog: [],
    modules: [],
    readModel,
    source: 'restricted',
    catalogGeneration,
    entitlementVersion,
    identity,
    userThemeMode,
    includeAllPermitted: false,
  });
}

export function getSnapshotSurfaceById(
  snapshot: WhiteLabelSnapshot,
  surfaceId: string,
): WhiteLabelSurfaceSnapshot | undefined {
  return snapshot.entries.find((entry) => entry.surfaceId === surfaceId);
}
