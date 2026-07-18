import type { ActivityCacheIdentity, ActivitySnapshot } from './activity-types';

let memoryCache: { key: string; snapshot: ActivitySnapshot } | null = null;

export function buildActivityCacheKey(input: ActivityCacheIdentity): string {
  return [
    'activity',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.branchId ?? 'none',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.activitySnapshotVersion,
    input.moduleCount,
  ].join(':');
}

export function readActivityCache(key: string): ActivitySnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readActivityCacheForIdentity(
  partial: Pick<
    ActivityCacheIdentity,
    'tenantId' | 'userId' | 'rolesHash' | 'branchId' | 'catalogGeneration' | 'entitlementVersion'
  >,
): ActivitySnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'activity',
    'registry',
    partial.tenantId,
    partial.userId,
    partial.rolesHash,
    partial.branchId ?? 'none',
    partial.catalogGeneration ?? 'none',
    partial.entitlementVersion ?? 'none',
  ].join(':');

  if (!memoryCache.key.startsWith(`${prefix}:`)) return null;
  return memoryCache.snapshot;
}

export function writeActivityCache(key: string, snapshot: ActivitySnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearActivityCache(): void {
  memoryCache = null;
}
