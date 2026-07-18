import {
  CANONICAL_DISCOVERY_SEARCH_ENTITIES,
  CANONICAL_SEARCH_ENTITIES,
} from '@booking/module-registry/search';
import type { SearchCatalogEntry } from './search-types';

function normalizeResourceIds(value: string | string[]): string[] {
  return Array.isArray(value) ? [...value] : [value];
}

/**
 * Authoritative static search catalog — generated from canonical registry vocabulary (Phase 32a).
 * Parity baseline for Phase 32b DynamicSearchProvider.
 */
export const STATIC_SEARCH_CATALOG: SearchCatalogEntry[] = [
  ...CANONICAL_SEARCH_ENTITIES.map((entity) => ({
    extensionId: `${entity.moduleId}/search/${entity.localId}`,
    moduleId: entity.moduleId,
    localId: entity.localId,
    entityType: entity.entityType,
    labelKey: entity.labelKey,
    resourceIds: normalizeResourceIds(entity.resourceId),
    deepLinkTemplate: entity.deepLinkTemplate,
    backendProviderKey: entity.backendProviderKey,
    searchScope: 'executable' as const,
    deprecatedAliases: entity.deprecatedAliases,
    category: entity.category,
    sortOrder: entity.sortOrder,
  })),
  ...CANONICAL_DISCOVERY_SEARCH_ENTITIES.map((entity) => ({
    extensionId: `${entity.moduleId}/search/${entity.localId}`,
    moduleId: entity.moduleId,
    localId: entity.localId,
    entityType: entity.discoveryKey,
    labelKey: entity.labelKey,
    resourceIds: [entity.resourceId],
    deepLinkTemplate: entity.deepLinkTemplate,
    backendProviderKey: entity.backendProviderKey,
    searchScope: 'discovery' as const,
    discoveryKey: entity.discoveryKey,
    deprecatedAliases: entity.deprecatedAliases,
    sortOrder: entity.sortOrder,
  })),
];

export function listExecutableCatalogEntityTypes(): string[] {
  return STATIC_SEARCH_CATALOG.filter((entry) => entry.searchScope === 'executable').map(
    (entry) => entry.entityType,
  );
}

export function listDiscoveryCatalogKeys(): string[] {
  return STATIC_SEARCH_CATALOG.filter((entry) => entry.searchScope === 'discovery').map(
    (entry) => entry.discoveryKey!,
  );
}

export function getCatalogEntry(extensionId: string): SearchCatalogEntry | undefined {
  return STATIC_SEARCH_CATALOG.find((entry) => entry.extensionId === extensionId);
}

export function getCatalogEntryByEntityType(entityType: string): SearchCatalogEntry | undefined {
  return STATIC_SEARCH_CATALOG.find(
    (entry) => entry.searchScope === 'executable' && entry.entityType === entityType,
  );
}
