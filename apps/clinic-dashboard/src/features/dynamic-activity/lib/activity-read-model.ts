import type { ActivitySnapshot } from './activity-types';
import { getSnapshotFeedById, getSnapshotHubById } from './activity-snapshot-builder';

export interface ActivityWidgetConfig {
  viewAllHref: string;
  showWidget: boolean;
}

/** Dashboard / shell configuration derived from ActivitySnapshot only. */
export function resolveActivityWidgetConfig(snapshot: ActivitySnapshot | null | undefined): ActivityWidgetConfig {
  if (!snapshot?.canViewActivity) {
    return { viewAllHref: '/reports', showWidget: false };
  }

  const hub = getSnapshotHubById(snapshot, 'activity-center');
  const globalFeed = getSnapshotFeedById(snapshot, 'global');

  return {
    viewAllHref: hub?.route ?? globalFeed?.route ?? '/activity',
    showWidget: snapshot.canViewActivity,
  };
}

export function resolveActivityFeedRoute(
  snapshot: ActivitySnapshot | null | undefined,
  feedId: string,
  fallback = '/activity',
): string {
  if (!snapshot) return fallback;
  return getSnapshotFeedById(snapshot, feedId)?.route ?? fallback;
}

export function listVisibleFeedIds(snapshot: ActivitySnapshot): string[] {
  return snapshot.feeds.map((feed) => feed.feedId);
}
