import type { AnalyticsCacheIdentity, AnalyticsSnapshot } from './analytics-types';

let memoryCache: { key: string; snapshot: AnalyticsSnapshot } | null = null;

export function buildAnalyticsCacheKey(input: AnalyticsCacheIdentity): string {
  return [
    'analytics',
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

export function readAnalyticsCache(key: string): AnalyticsSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readAnalyticsCacheForIdentity(
  partial: Pick<
    AnalyticsCacheIdentity,
    'tenantId' | 'userId' | 'rolesHash' | 'catalogGeneration' | 'entitlementVersion'
  >,
): AnalyticsSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'analytics',
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

export function writeAnalyticsCache(key: string, snapshot: AnalyticsSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearAnalyticsCache(): void {
  memoryCache = null;
}
