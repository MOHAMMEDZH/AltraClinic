import type { ReportingCacheIdentity, ReportSnapshot } from './reporting-types';

let memoryCache: { key: string; snapshot: ReportSnapshot } | null = null;

export function buildReportingCacheKey(input: ReportingCacheIdentity): string {
  return [
    'reporting',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.moduleCount,
    input.branchSnapshotVersion ?? 'none',
  ].join(':');
}

export function readReportingCache(key: string): ReportSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readReportingCacheForIdentity(
  partial: Pick<
    ReportingCacheIdentity,
    'tenantId' | 'userId' | 'rolesHash' | 'catalogGeneration' | 'entitlementVersion'
  >,
): ReportSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'reporting',
    'registry',
    partial.tenantId,
    partial.userId,
    partial.rolesHash,
    partial.catalogGeneration ?? 'none',
    partial.entitlementVersion ?? 'none',
  ].join(':');

  if (!memoryCache.key.startsWith(`${prefix}:`)) return null;
  return memoryCache.snapshot;
}

export function writeReportingCache(key: string, snapshot: ReportSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearReportingCache(): void {
  memoryCache = null;
}
