import type { NotificationCatalogSource, NotificationSnapshot } from './notification-types';

let memoryCache: { key: string; snapshot: NotificationSnapshot } | null = null;

export const NOTIFICATION_CACHE_VERSION = '1' as const;

export interface NotificationCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  locale: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  notificationConfigurationVersion: string;
  notificationSnapshotVersion: string;
  cacheVersion: string;
  moduleCount: number;
  source: Extract<NotificationCatalogSource, 'registry'>;
}

export function buildNotificationCacheKey(input: NotificationCacheIdentity): string {
  return [
    'notification',
    input.source,
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.activeBranchId ?? 'none',
    input.branchSnapshotVersion ?? 'none',
    input.whiteLabelSnapshotVersion ?? 'none',
    input.locale,
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.notificationConfigurationVersion,
    input.notificationSnapshotVersion,
    input.cacheVersion,
    input.moduleCount,
  ].join(':');
}

export function readNotificationCache(key: string): NotificationSnapshot | null {
  if (memoryCache?.key === key) return memoryCache.snapshot;
  return null;
}

export function readNotificationCacheForIdentity(input: {
  tenantId: string;
  userId: string;
  rolesHash: string;
  activeBranchId: string | null;
  branchSnapshotVersion: string | null;
  whiteLabelSnapshotVersion: string | null;
  locale: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  notificationConfigurationVersion: string;
}): NotificationSnapshot | null {
  if (!memoryCache || memoryCache.snapshot.source !== 'registry') return null;

  const prefix = [
    'notification',
    'registry',
    input.tenantId,
    input.userId,
    input.rolesHash,
    input.activeBranchId ?? 'none',
    input.branchSnapshotVersion ?? 'none',
    input.whiteLabelSnapshotVersion ?? 'none',
    input.locale,
    input.catalogGeneration ?? 'none',
    input.entitlementVersion ?? 'none',
    input.notificationConfigurationVersion,
  ].join(':');

  return memoryCache.key.startsWith(`${prefix}:`) ? memoryCache.snapshot : null;
}

export function writeNotificationCache(key: string, snapshot: NotificationSnapshot): void {
  memoryCache = { key, snapshot };
}

export function clearNotificationCache(): void {
  memoryCache = null;
}
