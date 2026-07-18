/**
 * STATIC_ANALYTICS_CATALOG is a parity baseline only — never runtime authority (Phase 34a M3).
 * Phase 34b DynamicAnalyticsProvider joins EffectiveModuleView against this catalog;
 * discoverability is resolved from the registry snapshot, not direct catalog reads in UI.
 */
export const STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and Phase 34b provider pipeline only. */
export const STATIC_ANALYTICS_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-analytics/lib/static-analytics-catalog.ts',
  'dynamic-analytics/lib/static-analytics-catalog.spec.ts',
  'dynamic-analytics/lib/static-analytics-catalog-runtime-isolation.spec.ts',
  'dynamic-analytics/analytics-cross-package-parity.spec.ts',
  'dynamic-analytics/context/DynamicAnalyticsProvider.tsx',
  'dynamic-analytics/lib/analytics-validation.ts',
  'dynamic-analytics/dynamic-analytics.spec.ts',
  'dynamic-analytics/dynamic-analytics-provider.spec.ts',
  'dynamic-analytics/dynamic-analytics-rollback.spec.ts',
] as const;

export function isStaticAnalyticsCatalogRuntimeAuthority(): false {
  return STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY;
}
