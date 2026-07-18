import type { BranchSnapshot, BranchWhiteLabelConfig } from './branch-types';
import { projectBranchWhiteLabelSlice } from './branch-merge';

/**
 * Branch → White Label coordination helper (SSOT §7.8 / §15).
 * Supplies inheritance layer 5 values only — White Label owns merge.
 */
export function getBranchWhiteLabelProjection(
  snapshot: BranchSnapshot | null | undefined,
): BranchWhiteLabelConfig | null {
  if (!snapshot) return null;
  return projectBranchWhiteLabelSlice(snapshot.view.configuration);
}

export function getBranchIdForWhiteLabel(
  snapshot: BranchSnapshot | null | undefined,
): string | null {
  return snapshot?.activeBranchId ?? null;
}
