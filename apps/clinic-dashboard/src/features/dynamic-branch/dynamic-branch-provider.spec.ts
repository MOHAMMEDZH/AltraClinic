import { describe, expect, it } from 'vitest';
import { STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY } from './lib/static-branch-catalog';
import { EMPTY_BRANCH_CAPABILITIES } from './lib/branch-types';
import { buildRestrictedBranchSnapshot } from './lib/branch-snapshot-builder';

describe('dynamic branch provider contracts (Phase 36b)', () => {
  it('keeps static catalog as non-authority', () => {
    expect(STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY).toBe(false);
  });

  it('restricted snapshot never widens capabilities', () => {
    const snapshot = buildRestrictedBranchSnapshot(
      {
        tenantId: 't1',
        userId: 'u1',
        rolesHash: 'r',
        locale: 'en',
        activeBranchId: null,
        primaryBranchId: null,
      },
      ['receptionist'],
      null,
      null,
    );
    expect(snapshot.capabilities.canAccessBranch).toBe(false);
    expect(snapshot.capabilities.canSwitchBranch).toBe(EMPTY_BRANCH_CAPABILITIES.canSwitchBranch);
    expect(snapshot.capabilities.canViewCrossBranch).toBe(false);
    expect(snapshot.capabilities.canManageBranchSettings).toBe(false);
    expect(snapshot.capabilities.canUseBranchBranding).toBe(false);
    expect(snapshot.entries).toHaveLength(0);
  });

  it('restricted snapshot with primary branch allows access only', () => {
    const snapshot = buildRestrictedBranchSnapshot(
      {
        tenantId: 't1',
        userId: 'u1',
        rolesHash: 'r',
        locale: 'en',
        activeBranchId: null,
        primaryBranchId: 'b1',
      },
      ['doctor'],
      1,
      'e1',
    );
    expect(snapshot.capabilities.canAccessBranch).toBe(true);
    expect(snapshot.activeBranchId).toBe('b1');
    expect(snapshot.capabilities.canSwitchBranch).toBe(false);
  });
});
