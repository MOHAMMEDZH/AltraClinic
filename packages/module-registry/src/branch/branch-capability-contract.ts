import {
  BRANCH_AGGREGATE_CAPABILITY_IDS,
  type BranchAggregateCapabilityContractEntry,
} from './branch-types';
import { CANONICAL_BRANCH_SURFACES } from './canonical-branch-surfaces';

/**
 * Aggregate branch capability contract (Phase 36a H1).
 * Architecture + validation only — runtime derivation is implemented in Phase 36b DynamicBranchProvider.
 * UI must never recompute these from RBAC or licensing matrices in registry mode.
 */
export const BRANCH_AGGREGATE_CAPABILITY_CONTRACT: readonly BranchAggregateCapabilityContractEntry[] = [
  {
    capabilityId: 'canAccessBranch',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'accessibleBranchIds.length > 0',
      'entries.some(kind=branch && userAccessible)',
      'bootstrap.branchModule.userAccessible',
    ],
    forbiddenClientDuplication: true,
    failClosedDefault: false,
  },
  {
    capabilityId: 'canSwitchBranch',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'canSelectBranch === true',
      'accessibleBranchIds.length > 1 OR branchAccessMode in (multi, global)',
      'activeBranchId resolvable OR branchAccessMode === global',
    ],
    forbiddenClientDuplication: true,
    failClosedDefault: false,
  },
  {
    capabilityId: 'canViewCrossBranch',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'canViewCrossBranch licensing + RBAC gate',
      'entries.some(surfaceId=reporting-cross-branch OR analytics-cross-branch && userAccessible)',
      'branchAccessMode === global OR enterprise cross-branch role',
    ],
    forbiddenClientDuplication: true,
    failClosedDefault: false,
  },
  {
    capabilityId: 'canManageBranchSettings',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'entries.some(adminAction in (update, manage) && userAccessible)',
      'permissionEvaluator(adminResourceId, adminAction)',
      'settings-branch-* surfaces visible for role',
    ],
    forbiddenClientDuplication: true,
    failClosedDefault: false,
  },
  {
    capabilityId: 'canUseBranchBranding',
    derivedFrom: 'snapshot',
    requiredSnapshotSignals: [
      'entries.some(categoryId=branch-white-label && userAccessible)',
      'requiredFeature in (customBranding, whiteLabel) satisfied',
      'Phase 35 white label layer 5 handoff eligible',
    ],
    forbiddenClientDuplication: true,
    failClosedDefault: false,
  },
] as const;

const CROSS_BRANCH_SURFACE_IDS = new Set(['reporting-cross-branch', 'analytics-cross-branch']);
const MANAGE_ACTIONS = new Set(['update', 'manage']);
const BRANCH_WHITE_LABEL_CATEGORY = 'branch-white-label';

/** Fail-closed validation that vocabulary supports aggregate capability derivation in 36b. */
export function validateBranchCapabilityContract(): string[] {
  const errors: string[] = [];

  if (BRANCH_AGGREGATE_CAPABILITY_CONTRACT.length !== BRANCH_AGGREGATE_CAPABILITY_IDS.length) {
    errors.push('Branch aggregate capability contract must define all capability IDs');
  }

  const contractIds = new Set(BRANCH_AGGREGATE_CAPABILITY_CONTRACT.map((entry) => entry.capabilityId));
  for (const capabilityId of BRANCH_AGGREGATE_CAPABILITY_IDS) {
    if (!contractIds.has(capabilityId)) {
      errors.push(`Missing branch capability contract entry for "${capabilityId}"`);
    }
  }

  if (CANONICAL_BRANCH_SURFACES.length < 1) {
    errors.push('canAccessBranch requires at least one canonical branch surface');
  }

  const crossBranchSurfaces = CANONICAL_BRANCH_SURFACES.filter((surface) =>
    CROSS_BRANCH_SURFACE_IDS.has(surface.surfaceId),
  );
  if (crossBranchSurfaces.length < 2) {
    errors.push('canViewCrossBranch requires reporting-cross-branch and analytics-cross-branch surfaces');
  }
  for (const surface of crossBranchSurfaces) {
    if (!surface.crossBranchAllowed) {
      errors.push(`canViewCrossBranch surface "${surface.surfaceId}" must declare crossBranchAllowed=true`);
    }
  }

  const manageSurfaces = CANONICAL_BRANCH_SURFACES.filter((surface) => MANAGE_ACTIONS.has(surface.adminAction));
  if (manageSurfaces.length < 1) {
    errors.push('canManageBranchSettings requires at least one branch surface with adminAction update or manage');
  }

  const brandingSurfaces = CANONICAL_BRANCH_SURFACES.filter(
    (surface) => surface.categoryId === BRANCH_WHITE_LABEL_CATEGORY,
  );
  if (brandingSurfaces.length < 1) {
    errors.push('canUseBranchBranding requires at least one branch-white-label category surface');
  }

  const switchEligible = CANONICAL_BRANCH_SURFACES.some(
    (surface) => surface.surfaceId === 'settings-branch-list' && surface.crossBranchAllowed,
  );
  if (!switchEligible) {
    errors.push('canSwitchBranch requires settings-branch-list with crossBranchAllowed metadata');
  }

  for (const entry of BRANCH_AGGREGATE_CAPABILITY_CONTRACT) {
    if (entry.derivedFrom !== 'snapshot' && entry.derivedFrom !== 'static-fallback') {
      errors.push(`Capability "${entry.capabilityId}" has invalid derivedFrom`);
    }
    if (!entry.forbiddenClientDuplication) {
      errors.push(`Capability "${entry.capabilityId}" must forbid client duplication`);
    }
    if (entry.failClosedDefault !== false) {
      errors.push(`Capability "${entry.capabilityId}" must default fail-closed to false`);
    }
    if (!entry.requiredSnapshotSignals.length) {
      errors.push(`Capability "${entry.capabilityId}" must declare requiredSnapshotSignals`);
    }
  }

  return errors;
}
