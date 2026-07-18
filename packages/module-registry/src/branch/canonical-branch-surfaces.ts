import { CANONICAL_BRANCH_ADDRESS_SURFACES } from './canonical-branch-address';
import { CANONICAL_BRANCH_ANALYTICS_SURFACES } from './canonical-branch-analytics';
import { CANONICAL_BRANCH_CLINICAL_SURFACES } from './canonical-branch-clinical';
import { CANONICAL_BRANCH_FINANCIAL_SURFACES } from './canonical-branch-financial';
import { CANONICAL_BRANCH_IDENTITY_SURFACES } from './canonical-branch-identity';
import { CANONICAL_BRANCH_INVENTORY_SURFACES } from './canonical-branch-inventory';
import { CANONICAL_BRANCH_REPORTING_SURFACES } from './canonical-branch-reporting';
import { CANONICAL_BRANCH_WHITE_LABEL_SURFACES } from './canonical-branch-white-label';
import type { CanonicalBranchSurface } from './branch-types';

/** Aggregated canonical branch surfaces — sole SSOT for manifest generation and static catalog. */
export const CANONICAL_BRANCH_SURFACES: readonly CanonicalBranchSurface[] = [
  ...CANONICAL_BRANCH_IDENTITY_SURFACES,
  ...CANONICAL_BRANCH_ADDRESS_SURFACES,
  ...CANONICAL_BRANCH_CLINICAL_SURFACES,
  ...CANONICAL_BRANCH_FINANCIAL_SURFACES,
  ...CANONICAL_BRANCH_INVENTORY_SURFACES,
  ...CANONICAL_BRANCH_REPORTING_SURFACES,
  ...CANONICAL_BRANCH_ANALYTICS_SURFACES,
  ...CANONICAL_BRANCH_WHITE_LABEL_SURFACES,
] as const;

export const CANONICAL_BRANCH_SURFACE_COUNT = CANONICAL_BRANCH_SURFACES.length;

export const CANONICAL_BRANCH_SURFACE_IDS = CANONICAL_BRANCH_SURFACES.map((surface) => surface.surfaceId);

export const CANONICAL_BRANCH_SURFACE_ID_SET = new Set(CANONICAL_BRANCH_SURFACE_IDS);

export const CANONICAL_BRANCH_SETTINGS_ROUTE_PATHS = [
  '/settings/branches',
  '/settings/scheduling',
  '/settings/queue',
  '/settings/billing',
  '/settings/inventory',
  '/settings/branding',
  '/reports',
  '/analytics',
] as const;

export const CANONICAL_BRANCH_ENTRY_COUNT = CANONICAL_BRANCH_SURFACE_COUNT;
