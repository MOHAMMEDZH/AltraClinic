import { describe, expect, it } from 'vitest';
import {
  BRANCH_AGGREGATE_CAPABILITY_IDS,
  validateBranchCapabilityContract,
  validateBranchSurfaceOwnershipContract,
  deriveBranchSurfaceOwnershipMetadata,
  CANONICAL_BRANCH_SURFACE_COUNT,
} from '../branch';

describe('branch remediation (Phase 36a final)', () => {
  it('validates aggregate capability contract with zero errors', () => {
    expect(validateBranchCapabilityContract()).toEqual([]);
    expect(BRANCH_AGGREGATE_CAPABILITY_IDS).toHaveLength(5);
  });

  it('validates surface ownership contract for all canonical surfaces', () => {
    expect(validateBranchSurfaceOwnershipContract()).toEqual([]);
    expect(deriveBranchSurfaceOwnershipMetadata()).toHaveLength(CANONICAL_BRANCH_SURFACE_COUNT);
  });
});
