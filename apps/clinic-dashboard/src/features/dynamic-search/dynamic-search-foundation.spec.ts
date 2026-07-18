import { describe, expect, it } from 'vitest';
import { listAllBuiltinSearchContributions } from '@booking/module-registry/search';
import {
  getCatalogEntry,
  listDiscoveryCatalogKeys,
  listExecutableCatalogEntityTypes,
  STATIC_SEARCH_CATALOG,
} from './lib/static-search-catalog';
import { assertSearchCatalogValid, verifySearchCatalogParity } from './lib/search-validation';

describe('static search catalog generation', () => {
  it('derives catalog entries from canonical registry vocabulary', () => {
    const contributions = listAllBuiltinSearchContributions();
    expect(STATIC_SEARCH_CATALOG).toHaveLength(contributions.length);
    for (const contribution of contributions) {
      const catalog = getCatalogEntry(contribution.extensionId);
      expect(catalog, contribution.extensionId).toBeTruthy();
      expect(catalog?.searchScope).toBe(contribution.searchScope);
    }
  });

  it('never includes queue in executable catalog types', () => {
    const types = listExecutableCatalogEntityTypes();
    expect(types).not.toContain('queue');
    expect(types).not.toContain('queue_ticket');
    expect(types).not.toContain('queueTicket');
  });

  it('lists exactly 26 executable and 9 discovery catalog entries', () => {
    expect(listExecutableCatalogEntityTypes()).toHaveLength(26);
    expect(listDiscoveryCatalogKeys()).toHaveLength(9);
  });

  it('passes catalog integrity validation', () => {
    const errors = assertSearchCatalogValid(STATIC_SEARCH_CATALOG);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('matches manifest contribution parity', () => {
    const mismatches = verifySearchCatalogParity(listAllBuiltinSearchContributions(), STATIC_SEARCH_CATALOG);
    expect(mismatches, JSON.stringify(mismatches, null, 2)).toEqual([]);
  });

  it('preserves multi-resource treatment resourceIds', () => {
    const treatment = STATIC_SEARCH_CATALOG.find((entry) => entry.entityType === 'treatment');
    expect(treatment?.resourceIds).toEqual(['api.dental', 'api.beauty']);
  });
});
