import type { ModuleManifest } from '../types';
import {
  CANONICAL_DISCOVERY_SEARCH_ENTITIES,
  CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT,
  QUEUE_SEARCH_STRATEGY,
} from './canonical-discovery-search';
import {
  CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT,
  CANONICAL_SEARCH_ENTITIES,
  CANONICAL_SEARCH_ENTITY_TYPES,
  type CanonicalSearchEntityType,
} from './canonical-search-entities';

const FORBIDDEN_QUEUE_ENTITY_TYPES = new Set(['queue', 'queue_ticket', 'queueTicket']);

export function validateBuiltinSearchIntegrity(manifests: ModuleManifest[]): string[] {
  const errors: string[] = [];
  const executableTypes = new Set<string>(CANONICAL_SEARCH_ENTITY_TYPES);
  const executableByType = new Map(
    CANONICAL_SEARCH_ENTITIES.map((entity) => [entity.entityType, entity]),
  );
  const discoveryByKey = new Map(
    CANONICAL_DISCOVERY_SEARCH_ENTITIES.map((entity) => [entity.discoveryKey, entity]),
  );
  const seenExtensionIds = new Map<string, string>();
  const seenExecutableTypes = new Map<string, string>();
  const seenDiscoveryKeys = new Map<string, string>();

  for (const manifest of manifests) {
    const search = manifest.extensions.search ?? [];
    for (const contribution of search) {
      const owner = contribution.extensionId;

      if (seenExtensionIds.has(contribution.extensionId)) {
        errors.push(
          `Duplicate search extensionId "${contribution.extensionId}" (${seenExtensionIds.get(contribution.extensionId)} and ${owner})`,
        );
      } else {
        seenExtensionIds.set(contribution.extensionId, owner);
      }

      if (!contribution.extensionId.startsWith(`${manifest.moduleId}/search/`)) {
        errors.push(
          `Search extensionId "${contribution.extensionId}" must be prefixed with ${manifest.moduleId}/search/`,
        );
      }

      if (!contribution.searchScope) {
        errors.push(`Search contribution ${owner} missing searchScope`);
        continue;
      }

      if (FORBIDDEN_QUEUE_ENTITY_TYPES.has(contribution.entityType)) {
        errors.push(
          `Queue search entity "${contribution.entityType}" forbidden (strategy: ${QUEUE_SEARCH_STRATEGY})`,
        );
      }

      if (contribution.searchScope === 'executable') {
        if (!executableTypes.has(contribution.entityType)) {
          errors.push(
            `Orphan executable search entityType "${contribution.entityType}" on module ${manifest.moduleId}`,
          );
          continue;
        }

        const canonical = executableByType.get(contribution.entityType as CanonicalSearchEntityType)!;
        if (canonical.moduleId !== manifest.moduleId) {
          errors.push(
            `Executable entity "${contribution.entityType}" declared on ${manifest.moduleId} but canonical owner is ${canonical.moduleId}`,
          );
        }

        if (contribution.deepLinkTemplate !== canonical.deepLinkTemplate) {
          errors.push(
            `Entity "${contribution.entityType}" deepLinkTemplate mismatch: manifest=${contribution.deepLinkTemplate} canonical=${canonical.deepLinkTemplate}`,
          );
        }

        const prior = seenExecutableTypes.get(contribution.entityType);
        if (prior) {
          errors.push(`Duplicate executable entityType "${contribution.entityType}" (${prior} and ${owner})`);
        } else {
          seenExecutableTypes.set(contribution.entityType, owner);
        }
      } else if (contribution.searchScope === 'discovery') {
        const discoveryKey = contribution.discoveryKey ?? contribution.entityType;
        const canonical = discoveryByKey.get(discoveryKey);
        if (!canonical) {
          errors.push(
            `Orphan discovery search key "${discoveryKey}" on module ${manifest.moduleId}`,
          );
          continue;
        }

        if (canonical.moduleId !== manifest.moduleId) {
          errors.push(
            `Discovery key "${discoveryKey}" declared on ${manifest.moduleId} but canonical owner is ${canonical.moduleId}`,
          );
        }

        const prior = seenDiscoveryKeys.get(discoveryKey);
        if (prior) {
          errors.push(`Duplicate discovery key "${discoveryKey}" (${prior} and ${owner})`);
        } else {
          seenDiscoveryKeys.set(discoveryKey, owner);
        }

        if (executableTypes.has(contribution.entityType)) {
          errors.push(
            `Discovery contribution ${owner} must not use executable entityType "${contribution.entityType}"`,
          );
        }
      } else {
        errors.push(`Invalid searchScope "${contribution.searchScope}" on ${owner}`);
      }
    }
  }

  for (const entityType of executableTypes) {
    if (!seenExecutableTypes.has(entityType)) {
      errors.push(`Missing executable search contribution for canonical entity "${entityType}"`);
    }
  }

  for (const discovery of CANONICAL_DISCOVERY_SEARCH_ENTITIES) {
    if (!seenDiscoveryKeys.has(discovery.discoveryKey)) {
      errors.push(`Missing discovery search contribution for key "${discovery.discoveryKey}"`);
    }
  }

  if (QUEUE_SEARCH_STRATEGY !== 'excluded') {
    errors.push(`Unexpected queue search strategy: ${QUEUE_SEARCH_STRATEGY}`);
  }

  const manifestSearchCount = manifests.reduce(
    (sum, manifest) => sum + (manifest.extensions.search?.length ?? 0),
    0,
  );
  const expectedCount =
    CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT + CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT;
  if (manifestSearchCount !== expectedCount) {
    errors.push(
      `Search contribution count mismatch: manifests=${manifestSearchCount} expected=${expectedCount}`,
    );
  }

  return errors;
}
