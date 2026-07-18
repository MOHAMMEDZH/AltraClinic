/**
 * STATIC_ACTIVITY_CATALOG is a parity baseline only — never runtime authority (Phase 38a).
 * Phase 38b DynamicActivityProvider joins EffectiveModuleView against this catalog;
 * discoverability is resolved from the registry snapshot / EffectiveActivityView, not direct catalog reads in UI.
 */
export const STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and Phase 38b provider pipeline only. */
export const STATIC_ACTIVITY_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-activity/lib/static-activity-catalog.ts',
  'dynamic-activity/lib/static-activity-catalog.spec.ts',
  'dynamic-activity/lib/static-activity-validation.ts',
  'dynamic-activity/activity-cross-package-parity.spec.ts',
  'dynamic-activity/dynamic-activity-foundation.spec.ts',
] as const;

export function isStaticActivityCatalogRuntimeAuthority(): false {
  return STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY;
}
