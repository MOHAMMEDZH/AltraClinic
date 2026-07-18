import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateAnalyticsLayerParity } from '@booking/module-registry/analytics';
import { STATIC_ANALYTICS_CATALOG } from './lib/static-analytics-catalog';

describe('analytics cross-package parity (Phase 34a)', () => {
  it('keeps canonical vocabulary, manifest contributions, and static catalog synchronized', () => {
    expect(validateAnalyticsLayerParity(BUILTIN_MODULE_MANIFESTS, STATIC_ANALYTICS_CATALOG)).toEqual([]);
  });
});
