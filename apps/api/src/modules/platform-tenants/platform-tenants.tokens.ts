import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

/**
 * Centralized platform audit-sentinel identity and exclusion helpers.
 * Used by Dashboard, Tenant Directory, audit infrastructure, provisioning,
 * and licensing so the sentinel never leaks into customer-facing paths.
 *
 * Lifecycle (frozen):
 * - Reserved identifier protection is always active (exact-match only).
 * - Persisted `tenants` row may be absent until an approved Platform audit
 *   adapter upserts it lazily for audit FK integrity.
 * - Absence of the row is not a startup fault and does not block ordinary tenants.
 * - Once present, the row is immutable via ordinary tenant workflows.
 */
export const PLATFORM_AUDIT_SENTINEL_TENANT_ID =
  '00000000-0000-4000-8000-000000000047' as const;

export const PLATFORM_AUDIT_SENTINEL_SLUG = 'pt-directory-audit-sentinel' as const;

export const PLATFORM_AUDIT_SENTINEL_DISPLAY_NAME =
  'Platform Tenants Directory Audit Sentinel' as const;

/** @deprecated Use PLATFORM_AUDIT_SENTINEL_TENANT_ID */
export const PLATFORM_TENANTS_DIRECTORY_AUDIT_TENANT_ID = PLATFORM_AUDIT_SENTINEL_TENANT_ID;

export const PLATFORM_TENANTS_AUDIT_LOG = Symbol('PLATFORM_TENANTS_AUDIT_LOG');

const sentinelLogger = new Logger('PlatformAuditSentinel');

export function isPlatformAuditSentinelTenantId(id: string | null | undefined): boolean {
  return id === PLATFORM_AUDIT_SENTINEL_TENANT_ID;
}

export function isPlatformAuditSentinelSlug(slug: string | null | undefined): boolean {
  return slug === PLATFORM_AUDIT_SENTINEL_SLUG;
}

/**
 * Reject reserved identity on production tenant write paths.
 * Emits a bounded collision signal (no PHI, tokens, bodies, or reserved id).
 */
export function assertNotPlatformAuditSentinelTenantId(
  id: string | null | undefined,
  sourcePath: string,
): void {
  if (!isPlatformAuditSentinelTenantId(id)) {
    return;
  }
  sentinelLogger.warn(
    JSON.stringify({
      event: 'platform_audit_sentinel_tenant_collision_rejected',
      action: 'tenant_write',
      result: 'rejected',
      sourcePath,
      errorCategory: 'reserved_identity_collision',
    }),
  );
  throw new Error('Reserved platform audit-sentinel identity cannot be used as a tenant');
}

/** Reject reserved sentinel slug on tenant write paths that accept caller-provided slugs. */
export function assertNotPlatformAuditSentinelSlug(
  slug: string | null | undefined,
  sourcePath: string,
): void {
  if (!isPlatformAuditSentinelSlug(slug)) {
    return;
  }
  sentinelLogger.warn(
    JSON.stringify({
      event: 'platform_audit_sentinel_tenant_collision_rejected',
      action: 'tenant_write',
      result: 'rejected',
      sourcePath,
      errorCategory: 'reserved_identity_collision',
    }),
  );
  throw new Error('Reserved platform audit-sentinel identity cannot be used as a tenant');
}

/** Prisma where fragment excluding the audit sentinel from Tenant queries. */
export const excludePlatformAuditSentinelTenantWhere = {
  id: { not: PLATFORM_AUDIT_SENTINEL_TENANT_ID },
  slug: { not: PLATFORM_AUDIT_SENTINEL_SLUG },
} as const;

/** SQL AND-able predicate excluding the audit sentinel from `tenants`. */
export function excludePlatformAuditSentinelSql(
  idColumn = Prisma.sql`id`,
  slugColumn = Prisma.sql`slug`,
): Prisma.Sql {
  return Prisma.sql`
    ${idColumn} <> ${PLATFORM_AUDIT_SENTINEL_TENANT_ID}::uuid
    AND ${slugColumn} <> ${PLATFORM_AUDIT_SENTINEL_SLUG}
  `;
}
