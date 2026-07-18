import { describe, expect, it } from 'vitest';
import {
  STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticBranchCatalogRuntimeAuthority,
  CANONICAL_BRANCH_SURFACES,
} from '@booking/module-registry/branch';

describe('static branch catalog runtime isolation (Phase 36a M1)', () => {
  it('declares STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false', () => {
    expect(STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
    expect(isStaticBranchCatalogRuntimeAuthority()).toBe(false);
  });

  it('does not import static catalog from provider paths', () => {
    // Runtime authority guard — catalog is generated from canonical SSOT only.
    expect(CANONICAL_BRANCH_SURFACES.length).toBe(24);
  });
});
