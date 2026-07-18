import type { LicensedModuleId } from '../types';

export const BRANCH_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

/** Licensed feature IDs branch surfaces may reference (subset of Phase 28 catalog). */
export const CANONICAL_BRANCH_FEATURE_IDS = ['customBranding', 'whiteLabel', 'analytics', 'reports'] as const;

export type CanonicalBranchFeatureId = (typeof CANONICAL_BRANCH_FEATURE_IDS)[number];

export type BranchCategoryId =
  | 'branch-identity'
  | 'branch-address'
  | 'branch-clinical'
  | 'branch-financial'
  | 'branch-inventory'
  | 'branch-reporting'
  | 'branch-analytics'
  | 'branch-white-label';

export type BranchConfigurationCategoryId = BranchCategoryId;

export type BranchInheritanceMode = 'tenant-default' | 'branch-override' | 'branch-only';

export type BranchAdminAction = 'view' | 'update' | 'manage';

export type BranchSurfaceKind =
  | 'identity'
  | 'address'
  | 'clinical'
  | 'financial'
  | 'inventory'
  | 'reporting'
  | 'analytics'
  | 'whiteLabel'
  | 'administration';

/** Aggregate branch capability IDs projected by DynamicBranchProvider (Phase 36b). */
export const BRANCH_AGGREGATE_CAPABILITY_IDS = [
  'canAccessBranch',
  'canSwitchBranch',
  'canViewCrossBranch',
  'canManageBranchSettings',
  'canUseBranchBranding',
] as const;

export type BranchAggregateCapabilityId = (typeof BRANCH_AGGREGATE_CAPABILITY_IDS)[number];

export type BranchCapabilityDerivationSource = 'snapshot' | 'static-fallback';

export interface BranchAggregateCapabilityContractEntry {
  capabilityId: BranchAggregateCapabilityId;
  derivedFrom: BranchCapabilityDerivationSource;
  requiredSnapshotSignals: readonly string[];
  forbiddenClientDuplication: true;
  failClosedDefault: false;
}

/** Explicit feature gate on a branch surface — `null` means module-licensed only (no feature flag). */
export type BranchSurfaceFeatureId = CanonicalBranchFeatureId | null;

export interface BranchSurfaceOwnershipMetadata {
  surfaceId: string;
  owningModuleId: LicensedModuleId;
  featureId: BranchSurfaceFeatureId;
  configurationCategory: BranchConfigurationCategoryId;
  inheritanceScope: {
    inheritanceMode: BranchInheritanceMode;
    branchScoped: boolean;
  };
  crossBranchSupport: boolean;
}

export interface CanonicalBranchCategory {
  categoryId: BranchCategoryId;
  configurationCategory: BranchConfigurationCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalBranchSurface {
  surfaceId: string;
  localId: string;
  moduleId: LicensedModuleId;
  surface: BranchSurfaceKind;
  categoryId: BranchCategoryId;
  configurationCategory: BranchConfigurationCategoryId;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  inheritanceMode: BranchInheritanceMode;
  adminResourceId: string;
  adminAction: BranchAdminAction;
  settingsPath: string;
  deepLinkTemplate: string;
  requiredFeature?: CanonicalBranchFeatureId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  providerKey: string;
  schemaVersion: typeof BRANCH_CONTRIBUTION_SCHEMA_VERSION;
  /** Reserved for Phase 37 — vocabulary only in 36a. */
  departmentScoped?: boolean;
}
