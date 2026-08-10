/**
 * Release 47 Step 12 — Healthcare Catalog stable-key and shared tokens.
 */
export const PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG = Symbol(
  'PLATFORM_HEALTHCARE_CATALOG_AUDIT_LOG',
);

export const PLATFORM_HEALTHCARE_CATALOG_CONFIG = Symbol(
  'PLATFORM_HEALTHCARE_CATALOG_CONFIG',
);

/** Strict canonical key: kindPrefix.snake_name */
export const CATALOG_KEY_REGEX = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export const CATALOG_LOCALES = ['en-US', 'ar-SY'] as const;
export type CatalogLocale = (typeof CATALOG_LOCALES)[number];

export const CATALOG_ICON_ALLOWLIST = [
  'clinic',
  'dental',
  'cosmetic',
  'lab',
  'radiology',
  'hospital',
  'multi',
  'module',
  'feature',
  'limit',
] as const;

export type CatalogKindName =
  | 'FACILITY_TYPE'
  | 'SPECIALTY'
  | 'MODULE'
  | 'FEATURE'
  | 'LIMIT';

export const KIND_PREFIX: Record<CatalogKindName, string> = {
  FACILITY_TYPE: 'facility_type',
  SPECIALTY: 'specialty',
  MODULE: 'module',
  FEATURE: 'feature',
  LIMIT: 'limit',
};

export function isValidCanonicalKey(kind: CatalogKindName, key: string): boolean {
  const normalized = key.trim();
  if (!CATALOG_KEY_REGEX.test(normalized)) return false;
  return normalized.startsWith(`${KIND_PREFIX[kind]}.`);
}

export function isAllowedCatalogLocale(locale: string): locale is CatalogLocale {
  return (CATALOG_LOCALES as readonly string[]).includes(locale);
}

export const KIND_VIEW_PERMISSION: Record<CatalogKindName, string> = {
  FACILITY_TYPE: 'facility-type.view',
  SPECIALTY: 'specialty.view',
  MODULE: 'module.view',
  FEATURE: 'feature.view',
  LIMIT: 'limit.view',
};

export const KIND_MANAGE_PERMISSION: Record<CatalogKindName, string> = {
  FACILITY_TYPE: 'facility-type.manage',
  SPECIALTY: 'specialty.manage',
  MODULE: 'module.manage',
  FEATURE: 'feature.manage',
  LIMIT: 'limit.manage',
};

export const ANY_CATALOG_VIEW = [
  'facility-type.view',
  'specialty.view',
  'module.view',
  'feature.view',
  'limit.view',
  'compatibility-rule.view',
] as const;
