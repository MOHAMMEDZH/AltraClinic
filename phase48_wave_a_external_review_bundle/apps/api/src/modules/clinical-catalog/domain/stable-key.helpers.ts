import {
  ClinicalCatalogValidationError,
  ClinicalCatalogErrorCode,
} from './clinical-catalog.errors';
import type { ClinicalServiceProvenance } from '@prisma/client';

export const CLINICAL_LOCALES = ['ar', 'en'] as const;
export type ClinicalLocale = (typeof CLINICAL_LOCALES)[number];

export const SYSTEM_CANONICAL_PREFIX = 'canonical.';
export const TENANT_CUSTOM_INFIX = '.custom.';

const STABLE_KEY_PATTERN = /^[a-z0-9][a-z0-9._-]{1,198}[a-z0-9]$/;

export function buildSystemCanonicalStableKey(domain: string, key: string): string {
  const normalizedDomain = normalizeSegment(domain);
  const normalizedKey = normalizeSegment(key);
  return `${SYSTEM_CANONICAL_PREFIX}${normalizedDomain}.${normalizedKey}`;
}

export function buildTenantCustomStableKey(tenantId: string, key: string): string {
  const normalizedKey = normalizeSegment(key);
  return `tenant.${tenantId}${TENANT_CUSTOM_INFIX}${normalizedKey}`;
}

export function normalizeSegment(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9._-]/g, '');
}

export function isValidStableKeyFormat(stableKey: string): boolean {
  return STABLE_KEY_PATTERN.test(stableKey);
}

export function validateStableKeyNamespace(
  provenance: ClinicalServiceProvenance,
  stableKey: string,
  tenantId: string | null | undefined,
): void {
  if (!isValidStableKeyFormat(stableKey)) {
    throw new ClinicalCatalogValidationError(
      'stableKey must be lowercase dot-separated segments (2–200 chars).',
      ClinicalCatalogErrorCode.NAMESPACE_INVALID,
    );
  }

  if (provenance === 'SYSTEM_CANONICAL') {
    if (!stableKey.startsWith(SYSTEM_CANONICAL_PREFIX)) {
      throw new ClinicalCatalogValidationError(
        'SYSTEM_CANONICAL stableKey must start with canonical.',
        ClinicalCatalogErrorCode.NAMESPACE_INVALID,
      );
    }
    if (tenantId != null) {
      throw new ClinicalCatalogValidationError(
        'SYSTEM_CANONICAL services must not have tenantId.',
        ClinicalCatalogErrorCode.NAMESPACE_INVALID,
      );
    }
    return;
  }

  if (provenance === 'TENANT_CUSTOM') {
    if (stableKey.startsWith(SYSTEM_CANONICAL_PREFIX)) {
      throw new ClinicalCatalogValidationError(
        'TENANT_CUSTOM stableKey cannot use canonical.* namespace.',
        ClinicalCatalogErrorCode.NAMESPACE_INVALID,
      );
    }
    if (!tenantId) {
      throw new ClinicalCatalogValidationError(
        'TENANT_CUSTOM services require tenantId.',
        ClinicalCatalogErrorCode.NAMESPACE_INVALID,
      );
    }
    const expectedPrefix = `tenant.${tenantId}${TENANT_CUSTOM_INFIX}`;
    if (!stableKey.startsWith(expectedPrefix)) {
      throw new ClinicalCatalogValidationError(
        `TENANT_CUSTOM stableKey must start with ${expectedPrefix}`,
        ClinicalCatalogErrorCode.NAMESPACE_INVALID,
      );
    }
  }
}

export function assertStableKeyImmutable(
  currentLifecycle: string,
  incomingStableKey: string | undefined,
  existingStableKey: string,
): void {
  if (incomingStableKey === undefined || incomingStableKey === existingStableKey) {
    return;
  }
  if (currentLifecycle !== 'DRAFT') {
    throw new ClinicalCatalogValidationError(
      'stableKey is immutable after publish.',
      ClinicalCatalogErrorCode.STABLE_KEY_IMMUTABLE,
    );
  }
}

export function schedulingIdToCanonicalStableKey(schedulingId: string): string {
  return buildSystemCanonicalStableKey('general', schedulingId);
}
