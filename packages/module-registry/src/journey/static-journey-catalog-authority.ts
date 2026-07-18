/**
 * STATIC_JOURNEY_CATALOG is a parity baseline only — never runtime authority (Phase 40a).
 * No DynamicJourneyProvider exists yet; discoverability continues to route through the
 * registry snapshot / EffectiveModuleView, never direct catalog reads in UI.
 */
export const STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests and catalog module only (Phase 40a; no provider pipeline yet). */
export const STATIC_JOURNEY_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-journey/lib/static-journey-catalog.ts',
  'dynamic-journey/lib/static-journey-catalog.spec.ts',
  'dynamic-journey/journey-cross-package-parity.spec.ts',
  'dynamic-journey/dynamic-journey-foundation.spec.ts',
] as const;

export function isStaticJourneyCatalogRuntimeAuthority(): false {
  return STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY;
}
