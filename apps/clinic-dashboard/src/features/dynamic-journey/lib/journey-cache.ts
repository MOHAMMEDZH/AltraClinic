import type { JourneyCatalogSource, JourneySnapshot } from './journey-types';

let memoryCache: { key: string; snapshot: JourneySnapshot } | null = null;

export const JOURNEY_CACHE_VERSION = '1' as const;

export interface JourneyCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  journeyConfigurationVersion: string;
  journeySnapshotVersion: string;
  cacheVersion: string;
  moduleCount: number;
  source: Extract<JourneyCatalogSource, 'registry'>;
}

export function buildJourneyCacheKey(input: JourneyCacheIdentity): string {
  return [
    'journey',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.activeBranchId ?? 'none',
    input.branchSnapshotVersion ?? 'none',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.journeyConfigurationVersion,
    input.journeySnapshotVersion,
    input.cacheVersion,
    input.moduleCount,
  ].join(':');
}

export function readJourneyCache(key: string): JourneySnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readJourneyCacheForIdentity(input: {
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  journeyConfigurationVersion: string;
}): JourneySnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'journey',
    'registry',
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.activeBranchId ?? 'none',
    input.branchSnapshotVersion ?? 'none',
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.journeyConfigurationVersion,
  ].join(':');

  return memoryCache.key.startsWith(`${prefix}:`) ? memoryCache.snapshot : null;
}

export function writeJourneyCache(key: string, snapshot: JourneySnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearJourneyCache(): void {
  memoryCache = null;
}

