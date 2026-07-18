import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinActivityIntegrity,
  validateCanonicalActivityVocabulary,
  CANONICAL_ACTIVITY_CATEGORY_COUNT,
  CANONICAL_ACTIVITY_SEVERITY_COUNT,
  CANONICAL_ACTIVITY_TYPE_COUNT,
  CANONICAL_ACTIVITY_FEED_COUNT,
  CANONICAL_ACTIVITY_HUB_COUNT,
  CANONICAL_CROSS_MODULE_ACTIVITY_COUNT,
  CANONICAL_ACTIVITY_ENTRY_COUNT,
  STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY,
  buildAllActivityContributions,
  buildActivityContributionsForModule,
} from '../activity';

describe('activity parity (Phase 38a)', () => {
  it('declares static catalog is never runtime authority', () => {
    expect(STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('canonical vocabulary counts are stable', () => {
    expect(CANONICAL_ACTIVITY_CATEGORY_COUNT).toBe(14);
    expect(CANONICAL_ACTIVITY_SEVERITY_COUNT).toBe(5);
    expect(CANONICAL_ACTIVITY_TYPE_COUNT).toBe(33);
    expect(CANONICAL_ACTIVITY_FEED_COUNT).toBe(7);
    expect(CANONICAL_ACTIVITY_HUB_COUNT).toBe(3);
    expect(CANONICAL_CROSS_MODULE_ACTIVITY_COUNT).toBe(3);
    expect(CANONICAL_ACTIVITY_ENTRY_COUNT).toBe(46);
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalActivityVocabulary()).toEqual([]);
  });

  it('buildAllActivityContributions produces expected count', () => {
    expect(buildAllActivityContributions()).toHaveLength(CANONICAL_ACTIVITY_ENTRY_COUNT);
  });

  it('per-module builders avoid handwritten activity entries', () => {
    expect(buildActivityContributionsForModule('patients').every((c) => c.activityKind === 'type')).toBe(
      true,
    );
    expect(buildActivityContributionsForModule('notifications').length).toBe(7 + 3 + 2);
  });

  it('builtin manifests satisfy activity integrity', () => {
    const errors = validateBuiltinActivityIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
