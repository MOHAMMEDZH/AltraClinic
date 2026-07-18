import type { LicensedModuleId, SearchContribution } from '../types';
import { moduleSearch } from '../builtin/extension-builders';
import {
  CANONICAL_DISCOVERY_SEARCH_ENTITIES,
  type CanonicalDiscoverySearchEntity,
} from './canonical-discovery-search';
import {
  CANONICAL_SEARCH_ENTITIES,
  type CanonicalSearchEntity,
} from './canonical-search-entities';

function toExecutableContribution(entity: CanonicalSearchEntity): SearchContribution {
  const resourceId = Array.isArray(entity.resourceId) ? entity.resourceId[0]! : entity.resourceId;
  return moduleSearch(
    entity.moduleId,
    entity.localId,
    entity.entityType,
    resourceId,
    entity.deepLinkTemplate,
    entity.labelKey,
    {
      sortOrder: entity.sortOrder,
      searchScope: 'executable',
      permissionResources: Array.isArray(entity.resourceId)
        ? entity.resourceId
        : [entity.resourceId],
      backendProviderKey: entity.backendProviderKey,
      deprecatedAliases: entity.deprecatedAliases,
    },
  );
}

function toDiscoveryContribution(entity: CanonicalDiscoverySearchEntity): SearchContribution {
  return moduleSearch(
    entity.moduleId,
    entity.localId,
    entity.discoveryKey,
    entity.resourceId,
    entity.deepLinkTemplate,
    entity.labelKey,
    {
      sortOrder: entity.sortOrder,
      searchScope: 'discovery',
      backendProviderKey: entity.backendProviderKey,
      discoveryKey: entity.discoveryKey,
      deprecatedAliases: entity.deprecatedAliases,
    },
  );
}

const executableByModule = new Map<LicensedModuleId, SearchContribution[]>();
const discoveryByModule = new Map<LicensedModuleId, SearchContribution[]>();

for (const entity of CANONICAL_SEARCH_ENTITIES) {
  const list = executableByModule.get(entity.moduleId) ?? [];
  list.push(toExecutableContribution(entity));
  executableByModule.set(entity.moduleId, list);
}

for (const entity of CANONICAL_DISCOVERY_SEARCH_ENTITIES) {
  const list = discoveryByModule.get(entity.moduleId) ?? [];
  list.push(toDiscoveryContribution(entity));
  discoveryByModule.set(entity.moduleId, list);
}

function sortContributions(list: SearchContribution[]): SearchContribution[] {
  return [...list].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

for (const [moduleId, list] of executableByModule) {
  executableByModule.set(moduleId, sortContributions(list));
}

for (const [moduleId, list] of discoveryByModule) {
  discoveryByModule.set(moduleId, sortContributions(list));
}

export function buildExecutableSearchContributionsForModule(
  moduleId: LicensedModuleId,
): SearchContribution[] {
  return executableByModule.get(moduleId) ?? [];
}

export function buildDiscoverySearchContributionsForModule(
  moduleId: LicensedModuleId,
): SearchContribution[] {
  return discoveryByModule.get(moduleId) ?? [];
}

export function buildSearchContributionsForModule(
  moduleId: LicensedModuleId,
): SearchContribution[] {
  return [
    ...buildExecutableSearchContributionsForModule(moduleId),
    ...buildDiscoverySearchContributionsForModule(moduleId),
  ];
}

export function listAllBuiltinSearchContributions(): SearchContribution[] {
  return [
    ...CANONICAL_SEARCH_ENTITIES.map(toExecutableContribution),
    ...CANONICAL_DISCOVERY_SEARCH_ENTITIES.map(toDiscoveryContribution),
  ];
}

export function listAllExecutableSearchContributions(): SearchContribution[] {
  return CANONICAL_SEARCH_ENTITIES.map(toExecutableContribution);
}

export function listAllDiscoverySearchContributions(): SearchContribution[] {
  return CANONICAL_DISCOVERY_SEARCH_ENTITIES.map(toDiscoveryContribution);
}
