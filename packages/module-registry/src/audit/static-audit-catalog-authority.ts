/**
 * STATIC_AUDIT_CATALOG is a parity baseline only — never runtime authority (Phase 39a).
 * Phase 39b DynamicAuditProvider joins EffectiveModuleView against this catalog;
 * discoverability is resolved from the registry snapshot / EffectiveAuditView, not direct catalog reads in UI.
 */
export const STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and Phase 39b provider pipeline only. */
export const STATIC_AUDIT_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-audit/lib/static-audit-catalog.ts',
  'dynamic-audit/lib/static-audit-catalog.spec.ts',
  'dynamic-audit/lib/static-audit-validation.ts',
  'dynamic-audit/audit-cross-package-parity.spec.ts',
  'dynamic-audit/dynamic-audit-foundation.spec.ts',
] as const;

export function isStaticAuditCatalogRuntimeAuthority(): false {
  return STATIC_AUDIT_CATALOG_IS_RUNTIME_AUTHORITY;
}
