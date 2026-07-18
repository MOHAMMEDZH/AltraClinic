import type { DashboardSnapshot } from './dashboard-types';
import type { DashboardCacheIdentity } from './dashboard-types';

let memoryCache: { key: string; snapshot: DashboardSnapshot } | null = null;

export function buildDashboardCacheKey(input: DashboardCacheIdentity): string {
  return [
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.profile,
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.moduleCount,
    input.branchSnapshotVersion ?? 'none',
  ].join(':');
}

export function readDashboardCache(key: string): DashboardSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function writeDashboardCache(key: string, snapshot: DashboardSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearDashboardCache(): void {
  memoryCache = null;
}
