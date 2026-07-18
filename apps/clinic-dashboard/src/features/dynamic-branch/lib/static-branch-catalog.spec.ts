import { describe, expect, it } from 'vitest';
import {
  CANONICAL_BRANCH_SURFACE_COUNT,
  STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY,
} from '@booking/module-registry/branch';
import { STATIC_BRANCH_CATALOG } from './static-branch-catalog';

describe('static branch catalog (Phase 36a)', () => {
  it('is not runtime authority', () => {
    expect(STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('maps all canonical surfaces', () => {
    expect(STATIC_BRANCH_CATALOG).toHaveLength(CANONICAL_BRANCH_SURFACE_COUNT);
    expect(STATIC_BRANCH_CATALOG).toHaveLength(24);
  });

  it('preserves unique branchSurfaceId values', () => {
    const ids = STATIC_BRANCH_CATALOG.map((entry) => entry.surfaceId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
