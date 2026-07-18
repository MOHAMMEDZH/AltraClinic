import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateBranchLayerParity } from '@booking/module-registry/branch';
import { STATIC_BRANCH_CATALOG } from './lib/static-branch-catalog';

describe('branch cross-package parity (Phase 36a)', () => {
  it('keeps canonical vocabulary, manifest contributions, and static catalog synchronized', () => {
    expect(validateBranchLayerParity(BUILTIN_MODULE_MANIFESTS, STATIC_BRANCH_CATALOG)).toEqual([]);
  });
});
