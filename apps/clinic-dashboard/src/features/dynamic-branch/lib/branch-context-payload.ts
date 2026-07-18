import type { BranchConfigurationSnapshot } from './branch-types';

/** Events defined by BranchContextRefreshContract (§21.2). */
export type BranchContextEvent =
  | 'branch.context.ready'
  | 'branch.context.changed'
  | 'branch.context.cleared'
  | 'branch.context.restricted'
  | 'branch.context.rollback'
  | 'branch.config.changed';

/**
 * Read-only handoff payload (§21.5).
 * Downstream providers must not mutate branch selection or session keys.
 */
export interface BranchContextPayload {
  activeBranchId: string | null;
  branchSnapshotVersion: string;
  tenantId: string;
  accessibleBranchIds: string[];
  /** Configuration slice — consumers may read filter defaults only. */
  configuration: BranchConfigurationSnapshot | null;
  event: BranchContextEvent;
}

export type BranchConsumerId =
  | 'whiteLabel'
  | 'navigation'
  | 'routing'
  | 'dashboard'
  | 'search'
  | 'reporting'
  | 'analytics'
  | 'activity'
  | 'audit'
  | 'journey'
  | 'notification';

export const BRANCH_CRITICAL_CONSUMERS: readonly BranchConsumerId[] = ['whiteLabel'];

/** §21.4 order 3 — may run in parallel after WhiteLabel. */
export const BRANCH_NAV_ROUTE_TIER: readonly BranchConsumerId[] = ['navigation', 'routing'];

/** §21.4 order 4 — may run in parallel after nav/route tier. */
export const BRANCH_CATALOG_TIER: readonly BranchConsumerId[] = [
  'dashboard',
  'search',
  'reporting',
  'analytics',
  'activity',
  'audit',
  'journey',
  'notification',
];

/** Deterministic refresh order for tests and single-flight documentation. */
export const BRANCH_REFRESH_ORDER: readonly BranchConsumerId[] = [
  'whiteLabel',
  'navigation',
  'routing',
  'dashboard',
  'search',
  'reporting',
  'analytics',
  'activity',
  'audit',
  'journey',
  'notification',
];
