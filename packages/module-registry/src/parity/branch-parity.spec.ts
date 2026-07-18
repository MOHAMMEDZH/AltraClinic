import { describe, expect, it } from 'vitest';
import { BUILTIN_MODULE_MANIFESTS, validateBuiltinManifestCompleteness } from '../index';
import {
  CANONICAL_BRANCH_CATEGORY_COUNT,
  CANONICAL_BRANCH_SURFACE_COUNT,
  buildBranchContributionsForModule,
  validateBuiltinBranchIntegrity,
  validateCanonicalBranchVocabulary,
  validateBranchCapabilityContract,
  validateBranchSurfaceOwnershipContract,
} from '../branch';

describe('branch parity (Phase 36a)', () => {
  it('validates canonical vocabulary with zero errors', () => {
    expect(validateCanonicalBranchVocabulary()).toEqual([]);
    expect(validateBranchCapabilityContract()).toEqual([]);
    expect(validateBranchSurfaceOwnershipContract()).toEqual([]);
  });

  it('validates builtin branch integrity with zero errors', () => {
    const errors = validateBuiltinBranchIntegrity(BUILTIN_MODULE_MANIFESTS);
    expect(errors, errors.join('\n')).toEqual([]);
  });

  it('includes branch integrity in bootstrap manifest completeness', () => {
    expect(validateBuiltinManifestCompleteness(BUILTIN_MODULE_MANIFESTS)).toEqual([]);
  });

  it('declares exactly 24 branch surfaces across 8 categories', () => {
    expect(CANONICAL_BRANCH_SURFACE_COUNT).toBe(24);
    expect(CANONICAL_BRANCH_CATEGORY_COUNT).toBe(8);
  });

  it('distributes branch surfaces across owning modules', () => {
    expect(buildBranchContributionsForModule('settings')).toHaveLength(13);
    expect(buildBranchContributionsForModule('scheduling')).toHaveLength(2);
    expect(buildBranchContributionsForModule('queue')).toHaveLength(1);
    expect(buildBranchContributionsForModule('billing')).toHaveLength(2);
    expect(buildBranchContributionsForModule('inventory')).toHaveLength(2);
    expect(buildBranchContributionsForModule('reporting')).toHaveLength(2);
    expect(buildBranchContributionsForModule('analytics')).toHaveLength(2);
  });

  it('uses generated extensionIds {moduleId}/branch/{localId}', () => {
    const contributions = buildBranchContributionsForModule('settings');
    for (const contribution of contributions) {
      expect(contribution.extensionId).toMatch(/^settings\/branch\/[a-z0-9-]+$/);
      expect(contribution.schemaVersion).toBe(1);
      expect(contribution.providerKey).toBe('branch.builtin');
    }
  });
});
