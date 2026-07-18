import type { AuditSnapshot } from './audit-types';
import { getSnapshotFeedById, getSnapshotSurfaceById } from './audit-snapshot-builder';

export interface AuditCenterConfig {
  centerHref: string;
  showAuditCenter: boolean;
  canExport: boolean;
}

/** Settings / shell configuration derived from AuditSnapshot only. */
export function resolveAuditCenterConfig(snapshot: AuditSnapshot | null | undefined): AuditCenterConfig {
  if (!snapshot?.canViewAuditCenter) {
    return { centerHref: '/settings', showAuditCenter: false, canExport: false };
  }

  const center = getSnapshotSurfaceById(snapshot, 'audit-center');
  const allFeed = getSnapshotFeedById(snapshot, 'all-authorized');

  return {
    centerHref: center?.route ?? allFeed?.route ?? '/settings/audit',
    showAuditCenter: snapshot.canViewAuditCenter,
    canExport: snapshot.canExportAudit,
  };
}

export function resolveAuditFeedRoute(
  snapshot: AuditSnapshot | null | undefined,
  feedId: string,
  fallback = '/settings/audit',
): string {
  if (!snapshot) return fallback;
  return getSnapshotFeedById(snapshot, feedId)?.route ?? fallback;
}

export function listVisibleAuditFeedIds(snapshot: AuditSnapshot): string[] {
  return snapshot.feeds.map((feed) => feed.feedId);
}
