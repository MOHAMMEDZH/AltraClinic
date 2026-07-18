const MULTI_BRANCH_ROLES = new Set(['super_admin', 'owner', 'general_manager', 'accountant']);

export function canSelectDashboardBranch(roles: string[]): boolean {
  return roles.some((role) => MULTI_BRANCH_ROLES.has(role));
}

/** `null` means all branches (tenant-wide). */
export function resolveDashboardBranchSelection(
  roles: string[],
  userBranchId: string | null | undefined,
  selectedBranchId: string | null,
): string | null {
  if (!canSelectDashboardBranch(roles)) {
    return userBranchId ?? null;
  }
  return selectedBranchId;
}
