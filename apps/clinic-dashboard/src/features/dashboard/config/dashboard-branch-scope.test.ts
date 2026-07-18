import { describe, expect, it } from 'vitest';
import {
  canSelectDashboardBranch,
  resolveDashboardBranchSelection,
} from './dashboard-branch-scope';

describe('dashboard-branch-scope', () => {
  it('allows owners to select branches', () => {
    expect(canSelectDashboardBranch(['owner'])).toBe(true);
  });

  it('locks receptionists to their branch', () => {
    expect(canSelectDashboardBranch(['receptionist'])).toBe(false);
    expect(resolveDashboardBranchSelection(['receptionist'], 'branch-1', null)).toBe('branch-1');
  });

  it('honours owner branch selection including all branches', () => {
    expect(resolveDashboardBranchSelection(['owner'], 'branch-1', null)).toBeNull();
    expect(resolveDashboardBranchSelection(['owner'], 'branch-1', 'branch-2')).toBe('branch-2');
  });
});
