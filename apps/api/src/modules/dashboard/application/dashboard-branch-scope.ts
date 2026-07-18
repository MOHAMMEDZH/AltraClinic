import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const MULTI_BRANCH_ROLES = new Set(['super_admin', 'owner', 'general_manager', 'accountant']);

export function canViewAllDashboardBranches(roles: string[]): boolean {
  return roles.some((role) => MULTI_BRANCH_ROLES.has(role));
}

/** Resolves the branch filter for dashboard overview queries. */
export function resolveDashboardBranchFilter(
  user: JwtClaimsVO,
  queryBranchId?: string,
): string | null {
  if (!canViewAllDashboardBranches(user.roles)) {
    return user.branchId ?? null;
  }

  const trimmed = queryBranchId?.trim();
  if (!trimmed || trimmed === 'all') {
    return null;
  }

  return trimmed;
}
