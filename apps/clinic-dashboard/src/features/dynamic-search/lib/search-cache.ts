import type { SearchCacheIdentity, SearchSnapshot } from './search-types';

let memoryCache: { key: string; snapshot: SearchSnapshot } | null = null;

export function buildSearchCacheKey(input: SearchCacheIdentity): string {
  return [
    'search',
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

export function readSearchCache(key: string): SearchSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

/** Returns the cached registry snapshot when identity dimensions match (any moduleCount). */
export function readSearchCacheForIdentity(
  partial: Pick<
    SearchCacheIdentity,
    'tenantId' | 'userId' | 'rolesHash' | 'catalogGeneration' | 'entitlementVersion'
  >,
): SearchSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'search',
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

export function writeSearchCache(key: string, snapshot: SearchSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearSearchCache(): void {
  memoryCache = null;
}
