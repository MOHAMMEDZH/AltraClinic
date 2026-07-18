import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  assertApiSearchEntityParity,
  buildSearchContributionsForModule,
  CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT,
  CANONICAL_DISCOVERY_SEARCH_ENTITIES,
  CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT,
  CANONICAL_SEARCH_ENTITIES,
  CANONICAL_SEARCH_ENTITY_TYPES,
  listAllBuiltinSearchContributions,
  listAllDiscoverySearchContributions,
  listAllExecutableSearchContributions,
  QUEUE_SEARCH_STRATEGY,
  validateBuiltinSearchIntegrity,
} from '../search';

describe('canonical search entity vocabulary', () => {
  it('defines exactly 26 executable entity types', () => {
    expect(CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT).toBe(26);
    expect(CANONICAL_SEARCH_ENTITY_TYPES).toHaveLength(26);
    expect(new Set(CANONICAL_SEARCH_ENTITY_TYPES).size).toBe(26);
  });

  it('maps each executable entity to a unique localId within its module', () => {
    const byModule = new Map<string, Set<string>>();
    for (const entity of CANONICAL_SEARCH_ENTITIES) {
      const key = entity.moduleId;
      const localIds = byModule.get(key) ?? new Set();
      expect(localIds.has(entity.localId), `${key}/${entity.localId}`).toBe(false);
      localIds.add(entity.localId);
      byModule.set(key, localIds);
    }
  });

  it('assigns unique extensionIds across all built-in search contributions', () => {
    const contributions = listAllBuiltinSearchContributions();
    const ids = contributions.map((c) => c.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(contributions).toHaveLength(
      CANONICAL_EXECUTABLE_SEARCH_ENTITY_COUNT + CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT,
    );
  });
});

describe('executable vs discovery taxonomy', () => {
  it('labels every executable contribution with searchScope executable', () => {
    for (const contribution of listAllExecutableSearchContributions()) {
      expect(contribution.searchScope).toBe('executable');
      expect(CANONICAL_SEARCH_ENTITY_TYPES).toContain(contribution.entityType);
      expect(contribution.discoveryKey).toBeUndefined();
    }
  });

  it('labels every discovery contribution with searchScope discovery', () => {
    for (const contribution of listAllDiscoverySearchContributions()) {
      expect(contribution.searchScope).toBe('discovery');
      expect(contribution.discoveryKey).toBeTruthy();
      expect(CANONICAL_SEARCH_ENTITY_TYPES).not.toContain(contribution.entityType);
    }
  });

  it('defines exactly 9 discovery entities', () => {
    expect(CANONICAL_DISCOVERY_SEARCH_ENTITY_COUNT).toBe(9);
    expect(CANONICAL_DISCOVERY_SEARCH_ENTITIES).toHaveLength(9);
  });
});

describe('queue search strategy', () => {
  it('excludes queue from global search contributions', () => {
    expect(QUEUE_SEARCH_STRATEGY).toBe('excluded');
    expect(buildSearchContributionsForModule('queue')).toEqual([]);
    const queueManifest = BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === 'queue');
    expect(queueManifest?.extensions.search).toBeUndefined();
  });
});

describe('multi-extension builder', () => {
  it('supports multiple executable entities per module', () => {
    expect(buildSearchContributionsForModule('emr').filter((c) => c.searchScope === 'executable')).toHaveLength(6);
    expect(buildSearchContributionsForModule('dental').filter((c) => c.searchScope === 'executable')).toHaveLength(5);
    expect(buildSearchContributionsForModule('beauty').filter((c) => c.searchScope === 'executable')).toHaveLength(4);
    expect(buildSearchContributionsForModule('workflow').filter((c) => c.searchScope === 'executable')).toHaveLength(3);
    expect(buildSearchContributionsForModule('billing').filter((c) => c.searchScope === 'executable')).toHaveLength(2);
  });

  it('generates extensionId from moduleId and localId', () => {
    const dental = buildSearchContributionsForModule('dental');
    expect(dental.map((c) => c.extensionId).sort()).toEqual([
      'dental/search/dental-image',
      'dental/search/dental-implant',
      'dental/search/dental-note',
      'dental/search/dental-ortho',
      'dental/search/dental-plan',
    ]);
  });
});

describe('search integrity validation', () => {
  it('declares every canonical entity exactly once in builtin manifests', () => {
    const errors = validateBuiltinSearchIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('includes search integrity in builtin completeness checks', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('matches API permission resource parity', () => {
    const errors = assertApiSearchEntityParity();
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
