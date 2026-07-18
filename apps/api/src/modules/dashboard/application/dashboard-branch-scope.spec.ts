import { Test, TestingModule } from '@nestjs/testing';
import { resolveDashboardBranchFilter, canViewAllDashboardBranches } from './dashboard-branch-scope';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

function claims(roles: string[], branchId: string | null = 'branch-1'): JwtClaimsVO {
  return new JwtClaimsVO({
    sub: 'user-1',
    tenantId: 'tenant-1',
    branchId,
    roles: roles as never[],
    sessionId: 'session-1',
  });
}

describe('dashboard-branch-scope', () => {
  it('allows owners to query all branches', () => {
    expect(canViewAllDashboardBranches(['owner'])).toBe(true);
    expect(resolveDashboardBranchFilter(claims(['owner']), 'all')).toBeNull();
    expect(resolveDashboardBranchFilter(claims(['owner']), undefined)).toBeNull();
  });

  it('locks receptionists to their branch', () => {
    expect(resolveDashboardBranchFilter(claims(['receptionist']), 'all')).toBe('branch-1');
    expect(resolveDashboardBranchFilter(claims(['receptionist']), 'branch-2')).toBe('branch-1');
  });

  it('honours explicit branch for owners', () => {
    expect(resolveDashboardBranchFilter(claims(['owner']), 'branch-2')).toBe('branch-2');
  });
});
