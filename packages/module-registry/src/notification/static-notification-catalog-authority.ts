/**
 * STATIC_NOTIFICATION_CATALOG is a parity baseline only — never runtime authority.
 * DynamicNotificationProvider (Phase 41b) reads this catalog only to join against
 * EffectiveModuleView contributions (fail-closed) — it never trusts the catalog alone for
 * accessibility. No delivery APIs, Prisma models, or workers exist yet; actual notification
 * delivery is untouched by Phase 41b (provider & configuration integration only).
 */
export const STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY = false as const;

/** Allowed importers — parity tests, catalog module, and the Phase 41b provider pipeline. */
export const STATIC_NOTIFICATION_CATALOG_ALLOWED_IMPORT_SUFFIXES = [
  'dynamic-notification/lib/static-notification-catalog.ts',
  'dynamic-notification/lib/static-notification-catalog.spec.ts',
  'dynamic-notification/notification-cross-package-parity.spec.ts',
  'dynamic-notification/dynamic-notification-foundation.spec.ts',
  'dynamic-notification/lib/notification-resolver.ts',
  'dynamic-notification/lib/notification-snapshot-builder.ts',
  'dynamic-notification/lib/notification-validation.ts',
  'dynamic-notification/context/DynamicNotificationProvider.tsx',
  'dynamic-notification/dynamic-notification.spec.ts',
  'dynamic-notification/dynamic-notification-provider.spec.ts',
  'dynamic-notification/dynamic-notification-rollback.spec.ts',
] as const;

export function isStaticNotificationCatalogRuntimeAuthority(): false {
  return STATIC_NOTIFICATION_CATALOG_IS_RUNTIME_AUTHORITY;
}
