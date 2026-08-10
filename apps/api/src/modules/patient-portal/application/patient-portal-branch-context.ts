import { PATIENT_PORTAL_ERROR_CODES } from '../patient-portal.constants';

/**
 * Phase 46a — Branch filter foundation (OD-BRANCH).
 * Branch is an optional filter only — never expands authorization.
 */

export interface PatientPortalBranchFilter {
  /** Optional branch filter applied to list queries. */
  branchId: string | null;
}

export class PatientPortalBranchContextError extends Error {
  constructor(
    readonly code: typeof PATIENT_PORTAL_ERROR_CODES.BRANCH_FILTER_INVALID,
    message: string,
  ) {
    super(message);
    this.name = 'PatientPortalBranchContextError';
  }
}

/**
 * Parses an optional branch query/header value.
 * Empty / missing → null (no filter). Invalid whitespace-only → error.
 * Does NOT grant all-branches access or broaden PHI scope.
 */
export function parsePatientPortalBranchFilter(
  candidate: string | null | undefined,
): PatientPortalBranchFilter {
  if (candidate === null || candidate === undefined) {
    return { branchId: null };
  }
  if (typeof candidate !== 'string') {
    throw new PatientPortalBranchContextError(
      PATIENT_PORTAL_ERROR_CODES.BRANCH_FILTER_INVALID,
      'Invalid branch filter',
    );
  }
  const trimmed = candidate.trim();
  if (!trimmed) {
    return { branchId: null };
  }
  return { branchId: trimmed };
}

/**
 * Applies branch filter to a list without expanding authorization.
 * Items without branchId are excluded when a filter is active (fail-closed filter).
 */
export function applyPatientPortalBranchFilter<T extends { branchId?: string | null }>(
  items: readonly T[],
  filter: PatientPortalBranchFilter,
): T[] {
  if (!filter.branchId) {
    return [...items];
  }
  return items.filter((item) => item.branchId === filter.branchId);
}
