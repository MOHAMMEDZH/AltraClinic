import type { AuditCacheIdentity, AuditSnapshot } from './audit-types';

let memoryCache: { key: string; snapshot: AuditSnapshot } | null = null;

export const AUDIT_CACHE_VERSION = '1' as const;

export function buildAuditCacheKey(input: AuditCacheIdentity): string {
  return [
    'audit',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.branchId ?? 'none',
    input.branchSnapshotVersion ?? 'none',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.auditSnapshotVersion,
    input.cacheVersion,
    input.moduleCount,
  ].join(':');
}

export function readAuditCache(key: string): AuditSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readAuditCacheForIdentity(
  partial: Pick<
    AuditCacheIdentity,
    | 'tenantId'
    | 'userId'
    | 'rolesHash'
    | 'branchId'
    | 'branchSnapshotVersion'
    | 'catalogGeneration'
    | 'entitlementVersion'
  >,
): AuditSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'audit',
    'registry',
    partial.tenantId,
    partial.userId,
    partial.rolesHash,
    partial.branchId ?? 'none',
    partial.branchSnapshotVersion ?? 'none',
    partial.catalogGeneration ?? 'none',
    partial.entitlementVersion ?? 'none',
  ].join(':');

  if (!memoryCache.key.startsWith(`${prefix}:`)) return null;
  return memoryCache.snapshot;
}

export function writeAuditCache(key: string, snapshot: AuditSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearAuditCache(): void {
  memoryCache = null;
}
