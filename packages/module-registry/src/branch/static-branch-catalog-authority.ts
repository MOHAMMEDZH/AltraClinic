/**
 * STATIC_BRANCH_CATALOG is a parity baseline only — never runtime authority (Phase 36a).
 * Phase 36b DynamicBranchProvider joins EffectiveModuleView against this catalog;
 * discoverability is resolved from the registry snapshot, not direct catalog reads in UI.
 */
export const STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and Phase 36b provider pipeline only. */
export const STATIC_BRANCH_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-branch/lib/static-branch-catalog.ts',
  'dynamic-branch/lib/static-branch-catalog.spec.ts',
  'dynamic-branch/branch-cross-package-parity.spec.ts',
  'dynamic-branch/dynamic-branch-foundation.spec.ts',
] as const;

export function isStaticBranchCatalogRuntimeAuthority(): false {
  return STATIC_BRANCH_CATALOG_IS_RUNTIME_AUTHORITY;
}
