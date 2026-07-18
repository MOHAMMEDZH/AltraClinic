export {
  BRANCH_CONTRIBUTION_SCHEMA_VERSION,
  BRANCH_AGGREGATE_CAPABILITY_IDS,
  CANONICAL_BRANCH_FEATURE_IDS,
  type BranchAdminAction,
  type BranchAggregateCapabilityId,
  type BranchAggregateCapabilityContractEntry,
  type BranchCapabilityDerivationSource,
  type BranchCategoryId,
  type BranchConfigurationCategoryId,
  type BranchInheritanceMode,
  type BranchSurfaceFeatureId,
  type BranchSurfaceKind,
  type BranchSurfaceOwnershipMetadata,
  type CanonicalBranchCategory,
  type CanonicalBranchFeatureId,
  type CanonicalBranchSurface,
} from './branch-types';

export {
  CANONICAL_BRANCH_CATEGORIES,
  CANONICAL_BRANCH_CATEGORY_COUNT,
  CANONICAL_BRANCH_CATEGORY_IDS,
  CANONICAL_BRANCH_CATEGORY_ID_SET,
  CANONICAL_BRANCH_CONFIGURATION_CATEGORY_IDS,
  CANONICAL_BRANCH_CONFIGURATION_CATEGORY_ID_SET,
} from './canonical-branch-categories';

export {
  CANONICAL_BRANCH_IDENTITY_SURFACES,
  CANONICAL_BRANCH_IDENTITY_SURFACE_COUNT,
} from './canonical-branch-identity';

export {
  CANONICAL_BRANCH_ADDRESS_SURFACES,
  CANONICAL_BRANCH_ADDRESS_SURFACE_COUNT,
} from './canonical-branch-address';

export {
  CANONICAL_BRANCH_CLINICAL_SURFACES,
  CANONICAL_BRANCH_CLINICAL_SURFACE_COUNT,
} from './canonical-branch-clinical';

export {
  CANONICAL_BRANCH_FINANCIAL_SURFACES,
  CANONICAL_BRANCH_FINANCIAL_SURFACE_COUNT,
} from './canonical-branch-financial';

export {
  CANONICAL_BRANCH_INVENTORY_SURFACES,
  CANONICAL_BRANCH_INVENTORY_SURFACE_COUNT,
} from './canonical-branch-inventory';

export {
  CANONICAL_BRANCH_REPORTING_SURFACES,
  CANONICAL_BRANCH_REPORTING_SURFACE_COUNT,
} from './canonical-branch-reporting';

export {
  CANONICAL_BRANCH_ANALYTICS_SURFACES,
  CANONICAL_BRANCH_ANALYTICS_SURFACE_COUNT,
} from './canonical-branch-analytics';

export {
  CANONICAL_BRANCH_WHITE_LABEL_SURFACES,
  CANONICAL_BRANCH_WHITE_LABEL_SURFACE_COUNT,
} from './canonical-branch-white-label';

export {
  CANONICAL_BRANCH_SURFACES,
  CANONICAL_BRANCH_SURFACE_COUNT,
  CANONICAL_BRANCH_SURFACE_IDS,
  CANONICAL_BRANCH_SURFACE_ID_SET,
  CANONICAL_BRANCH_SETTINGS_ROUTE_PATHS,
  CANONICAL_BRANCH_ENTRY_COUNT,
} from './canonical-branch-surfaces';

export {
  BRANCH_AGGREGATE_CAPABILITY_CONTRACT,
  validateBranchCapabilityContract,
} from './branch-capability-contract';

export {
  deriveBranchSurfaceOwnershipMetadata,
  validateBranchSurfaceOwnershipContract,
} from './validate-branch-surface-ownership';

export {
  STATIC_BRANCH_CATALOG_ALLOWED_IMPORT_SUFFIXES,
  STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticBranchCatalogRuntimeAuthority,
} from './static-branch-catalog-authority';

export {
  buildAllBranchContributions,
  buildBranchContributionsForModule,
  listAllBuiltinBranchContributions,
} from './build-branch-contributions';

export { validateBuiltinBranchIntegrity, collectManifestBranchContributions } from './validate-branch-integrity';
export { validateCanonicalBranchVocabulary } from './validate-canonical-branch-vocabulary';
export {
  validateStaticBranchCatalogParity,
  type StaticBranchCatalogEntryLike,
} from './validate-static-branch-catalog-parity';
export { validateBranchLayerParity } from './validate-branch-layer-parity';
