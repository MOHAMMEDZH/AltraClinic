import type { RouteSnapshot } from './route-types';
import type { RouteCacheIdentity } from './route-types';

let memoryCache: { key: string; snapshot: RouteSnapshot } | null = null;

export function buildRouteCacheKey(input: RouteCacheIdentity): string {
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

export function readRouteCache(key: string): RouteSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function writeRouteCache(key: string, snapshot: RouteSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearRouteCache(): void {
  memoryCache = null;
}
