import type { BranchCacheIdentity, BranchSnapshot } from './branch-types';

let memoryCache: { key: string; snapshot: BranchSnapshot } | null = null;

export function buildBranchCacheKey(input: BranchCacheIdentity): string {
  return [
    'branch',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.activeBranchId ?? 'none',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.settingsVersion,
    input.moduleCount,
  ].join(':');
}

export function readBranchCache(key: string): BranchSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readBranchCacheForIdentity(
  partial: Pick<
    BranchCacheIdentity,
    'tenantId' | 'userId' | 'rolesHash' | 'activeBranchId' | 'catalogGeneration' | 'entitlementVersion' | 'settingsVersion'
  >,
): BranchSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'branch',
    'registry',
    partial.tenantId,
    partial.userId,
    partial.rolesHash,
    partial.activeBranchId ?? 'none',
    partial.catalogGeneration ?? 'none',
    partial.entitlementVersion ?? 'none',
    partial.settingsVersion,
  ].join(':');

  if (!memoryCache.key.startsWith(`${prefix}:`)) return null;
  return memoryCache.snapshot;
}

export function writeBranchCache(key: string, snapshot: BranchSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearBranchCache(): void {
  memoryCache = null;
}
