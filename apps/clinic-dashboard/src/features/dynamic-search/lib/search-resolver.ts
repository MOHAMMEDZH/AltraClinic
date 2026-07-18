import type { EffectiveModuleView } from '@booking/module-registry';
import type { SearchCatalogEntry, SearchContributionView } from './search-types';

interface SearchExtensionPayload {
  entityType?: string;
  searchScope?: 'executable' | 'discovery';
  discoveryKey?: string;
  deepLinkTemplate?: string;
  permissionResources?: string[];
  resourceId?: string;
  backendProviderKey?: string;
  sortOrder?: number;
  labelKey?: string;
  userAccessible?: boolean;
}

function normalizeResourceIds(payload: SearchExtensionPayload): string[] {
  if (payload.permissionResources?.length) {
    return [...payload.permissionResources];
  }
  if (payload.resourceId) {
    return [payload.resourceId];
  }
  return [];
}

/**
 * Extracts search contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractSearchContributions(modules: EffectiveModuleView[]): SearchContributionView[] {
  const contributions: SearchContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'search') continue;

      const payload = extension.payload as SearchExtensionPayload;
      if (!payload.entityType || !payload.searchScope || !payload.deepLinkTemplate) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId,
        entityType: payload.entityType,
        labelKey: payload.labelKey ?? extension.labelKey,
        resourceIds: normalizeResourceIds(payload),
        deepLinkTemplate: payload.deepLinkTemplate,
        backendProviderKey: payload.backendProviderKey ?? `search.${module.moduleId}`,
        searchScope: payload.searchScope,
        discoveryKey: payload.discoveryKey,
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

export function resolveAccessibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userAccessible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

function isExtensionAccessible(contribution: SearchContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

/**
 * Determines if a catalog entry should be included for the current effective views.
 * Gates on extension-level access from EffectiveModuleView (no client RBAC duplication).
 */
export function isCatalogSearchEntryIncluded(
  entry: SearchCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: SearchContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return contribution.searchScope === entry.searchScope;
}

export function getCatalogEntryForContribution(
  catalog: SearchCatalogEntry[],
  contribution: SearchContributionView,
): SearchCatalogEntry | undefined {
  return catalog.find((entry) => entry.extensionId === contribution.extensionId);
}

export function listExecutableContributions(
  contributions: SearchContributionView[],
): SearchContributionView[] {
  return contributions.filter((contribution) => contribution.searchScope === 'executable');
}

export function listDiscoveryContributions(
  contributions: SearchContributionView[],
): SearchContributionView[] {
  return contributions.filter((contribution) => contribution.searchScope === 'discovery');
}
