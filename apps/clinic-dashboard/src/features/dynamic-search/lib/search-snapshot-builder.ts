import { hasPermission } from '@booking/permissions';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { SearchCatalogEntry, SearchCatalogSource, SearchSnapshot, SearchSnapshotEntry } from './search-types';
import {
  extractSearchContributions,
  isCatalogSearchEntryIncluded,
  resolveAccessibleModuleIds,
} from './search-resolver';

export interface BuildSearchSnapshotOptions {
  roles: string[];
  catalog: SearchCatalogEntry[];
  modules: EffectiveModuleView[];
  source: SearchCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  /** When true, include all catalog entries permitted by hasPermission (rollback / static-only). */
  includeAllPermitted?: boolean;
}

function toSnapshotEntry(entry: SearchCatalogEntry): SearchSnapshotEntry {
  return {
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    entityType: entry.entityType,
    labelKey: entry.labelKey,
    resourceIds: [...entry.resourceIds],
    deepLinkTemplate: entry.deepLinkTemplate,
    backendProviderKey: entry.backendProviderKey,
    searchScope: entry.searchScope,
    discoveryKey: entry.discoveryKey,
    sortOrder: entry.sortOrder ?? 0,
  };
}

function sortEntries(entries: SearchSnapshotEntry[]): SearchSnapshotEntry[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

function buildLookupMaps(executableEntries: SearchSnapshotEntry[]) {
  const deepLinkByEntityType: Record<string, string> = {};
  const labelKeyByEntityType: Record<string, string> = {};
  const backendProviderKeyByEntityType: Record<string, string> = {};

  for (const entry of executableEntries) {
    deepLinkByEntityType[entry.entityType] = entry.deepLinkTemplate;
    labelKeyByEntityType[entry.entityType] = entry.labelKey;
    backendProviderKeyByEntityType[entry.entityType] = entry.backendProviderKey;
  }

  return { deepLinkByEntityType, labelKeyByEntityType, backendProviderKeyByEntityType };
}

function filterStaticExecutableEntries(
  catalog: SearchCatalogEntry[],
  roles: string[],
): SearchCatalogEntry[] {
  return catalog.filter((entry) => {
    if (entry.searchScope !== 'executable') return false;
    const primaryResourceId = entry.resourceIds[0];
    return Boolean(primaryResourceId && hasPermission(roles, primaryResourceId, 'view'));
  });
}

function filterStaticDiscoveryEntries(
  catalog: SearchCatalogEntry[],
  roles: string[],
): SearchCatalogEntry[] {
  return catalog.filter((entry) => {
    if (entry.searchScope !== 'discovery') return false;
    return entry.resourceIds.some((resourceId) => hasPermission(roles, resourceId, 'view'));
  });
}

function filterRegistryEntries(
  catalog: SearchCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractSearchContributions>,
): { executable: SearchCatalogEntry[]; discovery: SearchCatalogEntry[] } {
  const executable: SearchCatalogEntry[] = [];
  const discovery: SearchCatalogEntry[] = [];

  for (const entry of catalog) {
    if (!isCatalogSearchEntryIncluded(entry, modules, contributions)) continue;
    if (entry.searchScope === 'executable') {
      executable.push(entry);
    } else {
      discovery.push(entry);
    }
  }

  return { executable, discovery };
}

export function buildSearchSnapshot(options: BuildSearchSnapshotOptions): SearchSnapshot {
  const contributions = extractSearchContributions(options.modules);
  let executableCatalog: SearchCatalogEntry[];
  let discoveryCatalog: SearchCatalogEntry[];

  if (options.includeAllPermitted) {
    executableCatalog = filterStaticExecutableEntries(options.catalog, options.roles);
    discoveryCatalog = filterStaticDiscoveryEntries(options.catalog, options.roles);
  } else {
    const filtered = filterRegistryEntries(options.catalog, options.modules, contributions);
    executableCatalog = filtered.executable;
    discoveryCatalog = filtered.discovery;
  }

  const executableEntries = sortEntries(executableCatalog.map(toSnapshotEntry));
  const discoveryEntries = sortEntries(discoveryCatalog.map(toSnapshotEntry));
  const entityTypes = executableEntries.map((entry) => entry.entityType);
  const enabledModuleIds = options.includeAllPermitted
    ? [...new Set(executableEntries.map((entry) => entry.moduleId))].sort()
    : [...resolveAccessibleModuleIds(options.modules)].sort();

  const lookups = buildLookupMaps(executableEntries);

  return {
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    entityTypes,
    typesParam: entityTypes.join(','),
    executableEntries,
    discoveryEntries,
    enabledModuleIds,
    canSearch: entityTypes.length > 0,
    ...lookups,
  };
}

export function buildRegistrySearchSnapshot(
  roles: string[],
  catalog: SearchCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): SearchSnapshot {
  return buildSearchSnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    includeAllPermitted: false,
  });
}

export function buildStaticSearchSnapshot(
  roles: string[],
  catalog: SearchCatalogEntry[],
  source: Extract<SearchCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): SearchSnapshot {
  return buildSearchSnapshot({
    roles,
    catalog,
    modules: [],
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    includeAllPermitted: true,
  });
}

/** Fail-closed registry placeholder while bootstrap resolves — never widens search surface. */
export function buildRestrictedSearchSnapshot(
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): SearchSnapshot {
  return {
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    entityTypes: [],
    typesParam: '',
    executableEntries: [],
    discoveryEntries: [],
    enabledModuleIds: [],
    deepLinkByEntityType: {},
    labelKeyByEntityType: {},
    backendProviderKeyByEntityType: {},
    canSearch: false,
  };
}

export function getSnapshotEntryForEntityType(
  snapshot: SearchSnapshot,
  entityType: string,
): SearchSnapshotEntry | undefined {
  return snapshot.executableEntries.find((entry) => entry.entityType === entityType);
}
