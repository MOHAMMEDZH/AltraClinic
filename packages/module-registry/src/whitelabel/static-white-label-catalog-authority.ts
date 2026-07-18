/**
 * STATIC_WHITE_LABEL_CATALOG is a parity baseline only — never runtime authority (Phase 35a).
 * Phase 35b DynamicWhiteLabelProvider joins EffectiveModuleView against this catalog;
 * discoverability is resolved from the registry snapshot, not direct catalog reads in UI.
 */
export const STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and Phase 35b provider pipeline only. */
export const STATIC_WHITE_LABEL_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-white-label/lib/static-white-label-catalog.ts',
  'dynamic-white-label/lib/static-white-label-catalog.spec.ts',
  'dynamic-white-label/white-label-cross-package-parity.spec.ts',
  'dynamic-white-label/dynamic-white-label-foundation.spec.ts',
] as const;

export function isStaticWhiteLabelCatalogRuntimeAuthority(): false {
  return STATIC_WHITE_LABEL_CATALOG_IS_RUNTIME_AUTHORITY;
}
