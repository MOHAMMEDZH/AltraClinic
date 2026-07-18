import type { ActivityCapabilityFlags, ActivityFeedSnapshot, ActivityHubSnapshot, ActivitySnapshot, ActivityTypeSnapshot } from './activity-types';

function hasFeed(feeds: ActivityFeedSnapshot[], feedId: string): boolean {
  return feeds.some((feed) => feed.feedId === feedId);
}

/** Aggregate capabilities projected exclusively from snapshot — never UI-recomputed. */
export function resolveActivityCapabilities(input: {
  activityTypes: ActivityTypeSnapshot[];
  feeds: ActivityFeedSnapshot[];
  hubs: ActivityHubSnapshot[];
}): ActivityCapabilityFlags {
  const { activityTypes, feeds, hubs } = input;

  const canViewClinicalFeed = hasFeed(feeds, 'clinical');
  const canViewFinancialFeed = hasFeed(feeds, 'financial');
  const canViewInventoryFeed = hasFeed(feeds, 'inventory');
  const canViewSecurityFeed = hasFeed(feeds, 'security');
  const canViewBranchFeed = hasFeed(feeds, 'branch');
  const canViewMyFeed = hasFeed(feeds, 'mine');

  const canViewActivity =
    activityTypes.length > 0 ||
    feeds.length > 0 ||
    hubs.some((hub) => hub.hubId === 'activity-center');

  return {
    canViewActivity,
    canViewClinicalFeed,
    canViewFinancialFeed,
    canViewInventoryFeed,
    canViewSecurityFeed,
    canViewBranchFeed,
    canViewMyFeed,
  };
}

export function resolveActivityCapabilitiesFromSnapshot(snapshot: ActivitySnapshot): ActivityCapabilityFlags {
  return {
    canViewActivity: snapshot.canViewActivity,
    canViewClinicalFeed: snapshot.canViewClinicalFeed,
    canViewFinancialFeed: snapshot.canViewFinancialFeed,
    canViewInventoryFeed: snapshot.canViewInventoryFeed,
    canViewSecurityFeed: snapshot.canViewSecurityFeed,
    canViewBranchFeed: snapshot.canViewBranchFeed,
    canViewMyFeed: snapshot.canViewMyFeed,
  };
}
