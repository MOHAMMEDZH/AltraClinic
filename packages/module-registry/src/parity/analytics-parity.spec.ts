import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  validateBuiltinAnalyticsIntegrity,
  validateCanonicalAnalyticsVocabulary,
  CANONICAL_ANALYTICS_DOMAIN_COUNT,
  CANONICAL_ANALYTICS_HUB_COUNT,
  CANONICAL_ANALYTICS_WIDGET_COUNT,
  CANONICAL_CROSS_MODULE_ANALYTICS_COUNT,
  CANONICAL_ANALYTICS_ENTRY_COUNT,
  CANONICAL_METRIC_IDS,
  buildAllAnalyticsContributions,
} from '../analytics';

describe('analytics parity (Phase 34a)', () => {
  it('canonical metric IDs are unique', () => {
    expect(new Set(CANONICAL_METRIC_IDS).size).toBe(CANONICAL_METRIC_IDS.length);
  });

  it('canonical vocabulary counts are stable', () => {
    expect(CANONICAL_ANALYTICS_DOMAIN_COUNT).toBe(11);
    expect(CANONICAL_ANALYTICS_WIDGET_COUNT).toBe(8);
    expect(CANONICAL_ANALYTICS_HUB_COUNT).toBe(3);
    expect(CANONICAL_CROSS_MODULE_ANALYTICS_COUNT).toBe(3);
    expect(CANONICAL_ANALYTICS_ENTRY_COUNT).toBe(25);
  });

  it('canonical vocabulary passes integrity validation', () => {
    expect(validateCanonicalAnalyticsVocabulary()).toEqual([]);
  });

  it('buildAllAnalyticsContributions produces expected count', () => {
    expect(buildAllAnalyticsContributions()).toHaveLength(CANONICAL_ANALYTICS_ENTRY_COUNT);
  });

  it('builtin manifests satisfy analytics integrity', () => {
    const errors = validateBuiltinAnalyticsIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors).toEqual([]);
  });

  it('builtin manifests satisfy global completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });
});
