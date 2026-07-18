import type { NavigationSnapshot } from './navigation-types';

export interface NavigationCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  source: NavigationSnapshot['source'];
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}

let memoryCache: { key: string; snapshot: NavigationSnapshot } | null = null;

export function buildNavigationCacheKey(input: NavigationCacheIdentity): string {
  return [
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

export function readNavigationCache(key: string): NavigationSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function writeNavigationCache(key: string, snapshot: NavigationSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearNavigationCache(): void {
  memoryCache = null;
}
