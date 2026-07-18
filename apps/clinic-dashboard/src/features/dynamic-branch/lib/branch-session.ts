import { ACTIVE_BRANCH_SESSION_KEY } from './branch-types';

/** Client active-branch selection — owned exclusively by DynamicBranchProvider (§19). */
export function readActiveBranchSession(): string | null {
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const value = sessionStorage.getItem(ACTIVE_BRANCH_SESSION_KEY);
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeActiveBranchSession(branchId: string | null): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    if (branchId == null || branchId === '') {
      sessionStorage.removeItem(ACTIVE_BRANCH_SESSION_KEY);
    } else {
      sessionStorage.setItem(ACTIVE_BRANCH_SESSION_KEY, branchId);
    }
  } catch {
    // ignore quota / private mode
  }
}

export function clearActiveBranchSession(): void {
  writeActiveBranchSession(null);
}
