import { describe, expect, it } from 'vitest';
import {
  STATIC_ACTIVITY_CATALOG,
  STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY,
} from './static-activity-catalog';
import { assertActivityCatalogValid } from './static-activity-validation';

describe('static activity catalog (Phase 38a)', () => {
  it('declares STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false', () => {
    expect(STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('contains 46 parity entries', () => {
    expect(STATIC_ACTIVITY_CATALOG).toHaveLength(46);
  });

  it('has unique extensionIds', () => {
    const ids = STATIC_ACTIVITY_CATALOG.map((entry) => entry.extensionId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('passes static catalog parity validation', () => {
    expect(assertActivityCatalogValid()).toEqual([]);
  });
});
