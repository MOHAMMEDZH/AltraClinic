import type { WhiteLabelCacheIdentity, WhiteLabelSnapshot } from './white-label-types';

let memoryCache: { key: string; snapshot: WhiteLabelSnapshot } | null = null;

export function buildWhiteLabelCacheKey(input: WhiteLabelCacheIdentity): string {
  return [
    'whitelabel',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.locale,
    input.themePreference,
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.brandingGeneration,
    input.assetGeneration,
    input.moduleCount,
    input.branchSnapshotVersion ?? 'none',
  ].join(':');
}

export function readWhiteLabelCache(key: string): WhiteLabelSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readWhiteLabelCacheForIdentity(
  partial: Pick<
    WhiteLabelCacheIdentity,
    | 'tenantId'
    | 'userId'
    | 'rolesHash'
    | 'locale'
    | 'themePreference'
    | 'catalogGeneration'
    | 'entitlementVersion'
    | 'brandingGeneration'
    | 'assetGeneration'
  >,
): WhiteLabelSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'whitelabel',
    'registry',
    partial.tenantId,
    partial.userId,
    partial.rolesHash,
    partial.locale,
    partial.themePreference,
    partial.catalogGeneration ?? 'none',
    partial.entitlementVersion ?? 'none',
    partial.brandingGeneration,
    partial.assetGeneration,
  ].join(':');

  if (!memoryCache.key.startsWith(`${prefix}:`)) return null;
  return memoryCache.snapshot;
}

export function writeWhiteLabelCache(key: string, snapshot: WhiteLabelSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearWhiteLabelCache(): void {
  memoryCache = null;
}
