import type { SearchContribution } from '@booking/module-registry';
import { listAllBuiltinSearchContributions } from '@booking/module-registry/search';
import type { SearchCatalogEntry, SearchParityMismatch, SearchSnapshot } from './search-types';
import { STATIC_SEARCH_CATALOG } from './static-search-catalog';

const DEEP_LINK_PLACEHOLDER = /\{[a-zA-Z]+\}/;

export interface SearchCatalogParityMismatch {
  extensionId: string;
  field: string;
  expected: string;
  actual: string;
}

function normalizeResourceIds(values: string[]): string {
  return [...values].sort().join(',');
}

export function assertSearchCatalogValid(catalog: SearchCatalogEntry[] = STATIC_SEARCH_CATALOG): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();
  const seenExecutableTypes = new Set<string>();
  const seenDiscoveryKeys = new Set<string>();
  const seenDeepLinks = new Map<string, string>();

  for (const entry of catalog) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate extensionId: ${entry.extensionId}`);
    }
    seenExtensionIds.add(entry.extensionId);

    if (!entry.extensionId.startsWith(`${entry.moduleId}/search/`)) {
      errors.push(`Invalid extensionId prefix for ${entry.extensionId}`);
    }

    if (!entry.moduleId) {
      errors.push(`Missing moduleId for ${entry.extensionId}`);
    }

    if (!entry.resourceIds.length) {
      errors.push(`Missing resourceIds for ${entry.extensionId}`);
    }

    for (const resourceId of entry.resourceIds) {
      if (!resourceId.startsWith('api.')) {
        errors.push(`Invalid resourceId "${resourceId}" on ${entry.extensionId}`);
      }
    }

    if (!entry.deepLinkTemplate.startsWith('/')) {
      errors.push(`Invalid deepLinkTemplate on ${entry.extensionId}`);
    }

    if (!entry.backendProviderKey.startsWith('search.')) {
      errors.push(`Invalid backendProviderKey on ${entry.extensionId}`);
    }

    const priorDeepLink = seenDeepLinks.get(`${entry.entityType}:${entry.deepLinkTemplate}`);
    if (priorDeepLink && priorDeepLink !== entry.extensionId) {
      errors.push(
        `Duplicate deepLinkTemplate for entity "${entry.entityType}" (${priorDeepLink} and ${entry.extensionId})`,
      );
    } else {
      seenDeepLinks.set(`${entry.entityType}:${entry.deepLinkTemplate}`, entry.extensionId);
    }

    if (entry.searchScope === 'executable') {
      if (seenExecutableTypes.has(entry.entityType)) {
        errors.push(`Duplicate executable entityType: ${entry.entityType}`);
      }
      seenExecutableTypes.add(entry.entityType);
      if (entry.discoveryKey) {
        errors.push(`Executable entry ${entry.extensionId} must not define discoveryKey`);
      }
    } else if (entry.searchScope === 'discovery') {
      const key = entry.discoveryKey ?? entry.entityType;
      if (seenDiscoveryKeys.has(key)) {
        errors.push(`Duplicate discovery key: ${key}`);
      }
      seenDiscoveryKeys.add(key);
      if (seenExecutableTypes.has(entry.entityType)) {
        errors.push(`Discovery entry ${entry.extensionId} must not reuse executable entityType`);
      }
    } else {
      errors.push(`Invalid searchScope on ${entry.extensionId}`);
    }
  }

  return errors;
}

export function assertSearchSnapshotValid(snapshot: SearchSnapshot): string[] {
  const errors: string[] = [];
  const seenTypes = new Set<string>();

  for (const entry of snapshot.executableEntries) {
    if (seenTypes.has(entry.entityType)) {
      errors.push(`Duplicate executable entityType in snapshot: ${entry.entityType}`);
    }
    seenTypes.add(entry.entityType);

    const catalog = STATIC_SEARCH_CATALOG.find((item) => item.extensionId === entry.extensionId);
    if (!catalog) {
      errors.push(`Snapshot executable entry missing catalog match: ${entry.extensionId}`);
      continue;
    }

    if (catalog.searchScope !== 'executable') {
      errors.push(`Snapshot executable entry is discovery in catalog: ${entry.extensionId}`);
    }

    if (normalizeResourceIds(entry.resourceIds) !== normalizeResourceIds(catalog.resourceIds)) {
      errors.push(`Snapshot resourceIds mismatch for ${entry.entityType}`);
    }
  }

  for (const entry of snapshot.discoveryEntries) {
    const catalog = STATIC_SEARCH_CATALOG.find((item) => item.extensionId === entry.extensionId);
    if (!catalog || catalog.searchScope !== 'discovery') {
      errors.push(`Snapshot discovery entry invalid: ${entry.extensionId}`);
    }
  }

  if (snapshot.entityTypes.join(',') !== snapshot.typesParam) {
    errors.push('Snapshot typesParam does not match entityTypes');
  }

  if (snapshot.canSearch !== snapshot.entityTypes.length > 0) {
    errors.push('Snapshot canSearch flag mismatch');
  }

  for (const entityType of snapshot.entityTypes) {
    if (!snapshot.deepLinkByEntityType[entityType]) {
      errors.push(`Missing deepLinkByEntityType for ${entityType}`);
    }
    if (!snapshot.labelKeyByEntityType[entityType]) {
      errors.push(`Missing labelKeyByEntityType for ${entityType}`);
    }
    if (!snapshot.backendProviderKeyByEntityType[entityType]) {
      errors.push(`Missing backendProviderKeyByEntityType for ${entityType}`);
    }
  }

  return errors;
}

export function verifySearchCatalogParity(
  contributions: SearchContribution[],
  catalog: SearchCatalogEntry[],
): SearchCatalogParityMismatch[] {
  const mismatches: SearchCatalogParityMismatch[] = [];
  const catalogById = new Map(catalog.map((entry) => [entry.extensionId, entry]));

  if (contributions.length !== catalog.length) {
    mismatches.push({
      extensionId: '*',
      field: 'length',
      expected: String(contributions.length),
      actual: String(catalog.length),
    });
  }

  for (const contribution of contributions) {
    const entry = catalogById.get(contribution.extensionId);
    if (!entry) {
      mismatches.push({
        extensionId: contribution.extensionId,
        field: 'presence',
        expected: 'present',
        actual: 'missing',
      });
      continue;
    }

    if (entry.searchScope !== contribution.searchScope) {
      mismatches.push({
        extensionId: contribution.extensionId,
        field: 'searchScope',
        expected: contribution.searchScope,
        actual: entry.searchScope,
      });
    }

    if (entry.entityType !== contribution.entityType) {
      mismatches.push({
        extensionId: contribution.extensionId,
        field: 'entityType',
        expected: contribution.entityType,
        actual: entry.entityType,
      });
    }

    if (entry.deepLinkTemplate !== contribution.deepLinkTemplate) {
      mismatches.push({
        extensionId: contribution.extensionId,
        field: 'deepLinkTemplate',
        expected: contribution.deepLinkTemplate,
        actual: entry.deepLinkTemplate,
      });
    }

    const contributionResources = normalizeResourceIds(contribution.permissionResources);
    const catalogResources = normalizeResourceIds(entry.resourceIds);
    if (contributionResources !== catalogResources) {
      mismatches.push({
        extensionId: contribution.extensionId,
        field: 'resourceIds',
        expected: contributionResources,
        actual: catalogResources,
      });
    }
  }

  return mismatches;
}

export function verifySearchParity(
  staticSnapshot: SearchSnapshot,
  registrySnapshot: SearchSnapshot,
): SearchParityMismatch[] {
  const mismatches: SearchParityMismatch[] = [];
  const expected = [...staticSnapshot.entityTypes].sort();
  const actual = [...registrySnapshot.entityTypes].sort();

  if (expected.length !== actual.length) {
    mismatches.push({
      entityType: '*',
      field: 'entityTypeCount',
      expected: String(expected.length),
      actual: String(actual.length),
    });
  }

  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);

  for (const entityType of expectedSet) {
    if (!actualSet.has(entityType)) {
      mismatches.push({
        entityType,
        field: 'entityType',
        expected: entityType,
        actual: '(missing)',
      });
    }
  }

  for (const entityType of actualSet) {
    if (!expectedSet.has(entityType)) {
      mismatches.push({
        entityType,
        field: 'entityType',
        expected: '(missing)',
        actual: entityType,
      });
    }
  }

  return mismatches;
}

export function assertSearchCatalogLoaded(): void {
  const errors = assertSearchCatalogValid(STATIC_SEARCH_CATALOG);
  if (errors.length > 0) {
    throw new Error(`Invalid static search catalog:\n${errors.join('\n')}`);
  }

  const parity = verifySearchCatalogParity(listAllBuiltinSearchContributions(), STATIC_SEARCH_CATALOG);
  if (parity.length > 0) {
    throw new Error(`Search catalog parity failed:\n${JSON.stringify(parity, null, 2)}`);
  }
}

export function isValidDeepLinkTemplate(template: string): boolean {
  return template.startsWith('/') && (template.includes('{') ? DEEP_LINK_PLACEHOLDER.test(template) : true);
}
