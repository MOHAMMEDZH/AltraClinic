import { describe, expect, it } from 'vitest';
import { CANONICAL_ANALYTICS_ENTRY_COUNT } from '@booking/module-registry/analytics';
import { STATIC_ANALYTICS_CATALOG } from './static-analytics-catalog';

describe('static analytics catalog (Phase 34a)', () => {
  it('contains the expected baseline entry count', () => {
    expect(STATIC_ANALYTICS_CATALOG).toHaveLength(CANONICAL_ANALYTICS_ENTRY_COUNT);
    expect(STATIC_ANALYTICS_CATALOG).toHaveLength(25);
  });

  it('uses stable extensionId pattern', () => {
    for (const entry of STATIC_ANALYTICS_CATALOG) {
      expect(entry.extensionId).toBe(`${entry.moduleId}/analytics/${entry.localId}`);
    }
  });
});
