import type { BranchAccessMode, BranchSummarySnapshot } from './branch-types';

/** Mirrors dashboard-branch-scope MULTI_BRANCH_ROLES — configuration parity only. */
const MULTI_BRANCH_ROLES = new Set(['super_admin', 'owner', 'general_manager', 'accountant']);
const CROSS_BRANCH_ROLES = new Set(['super_admin', 'owner', 'general_manager', 'accountant']);
const MANAGE_BRANCH_ROLES = new Set(['super_admin', 'owner', 'general_manager']);

export function canSelectBranchFromRoles(roles: string[]): boolean {
  return roles.some((role) => MULTI_BRANCH_ROLES.has(role));
}

export function canViewCrossBranchFromRoles(roles: string[]): boolean {
  return roles.some((role) => CROSS_BRANCH_ROLES.has(role));
}

export function canManageBranchesFromRoles(roles: string[]): boolean {
  return roles.some((role) => MANAGE_BRANCH_ROLES.has(role));
}

export function resolveBranchAccessMode(roles: string[]): BranchAccessMode {
  if (roles.includes('super_admin') || roles.includes('owner')) return 'global';
  if (canSelectBranchFromRoles(roles)) return 'multi';
  return 'single';
}

/**
 * Fail-closed active branch resolution (§19.3).
 * Never selects inaccessible or inactive branches.
 */
export function resolveActiveBranchId(input: {
  sessionBranchId: string | null;
  primaryBranchId: string | null;
  accessibleBranchIds: string[];
  branches: BranchSummarySnapshot[];
  canViewCrossBranch: boolean;
  branchAccessMode: BranchAccessMode;
}): string | null {
  const activeIds = new Set(
    input.branches.filter((branch) => branch.isActive).map((branch) => branch.id),
  );
  const accessible = input.accessibleBranchIds.filter((id) => activeIds.size === 0 || activeIds.has(id));

  const isValid = (id: string | null | undefined): id is string =>
    Boolean(id && accessible.includes(id));

  if (isValid(input.sessionBranchId)) return input.sessionBranchId;
  if (isValid(input.primaryBranchId)) return input.primaryBranchId;
  if (accessible.length === 1) return accessible[0]!;
  if (input.canViewCrossBranch && input.branchAccessMode === 'global') return null;
  return null;
}

export function buildAccessibleBranchIds(
  roles: string[],
  primaryBranchId: string | null,
  branches: BranchSummarySnapshot[],
): string[] {
  const active = branches.filter((branch) => branch.isActive);
  if (canSelectBranchFromRoles(roles) && active.length > 0) {
    return active.map((branch) => branch.id);
  }
  if (primaryBranchId) {
    const primary = active.find((branch) => branch.id === primaryBranchId);
    return primary ? [primary.id] : [primaryBranchId];
  }
  return [];
}
