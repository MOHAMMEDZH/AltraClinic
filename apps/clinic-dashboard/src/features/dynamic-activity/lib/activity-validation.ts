import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateActivityLayerParity } from '@booking/module-registry/activity';
import { resolveActivityCapabilitiesFromSnapshot } from './activity-capabilities';
import type { ActivitySnapshot } from './activity-types';
import { STATIC_ACTIVITY_CATALOG } from './static-activity-catalog';

export function assertActivityCatalogLoaded(): void {
  const errors = validateActivityLayerParity(BUILTIN_MODULE_MANIFESTS, [...STATIC_ACTIVITY_CATALOG]);
  if (errors.length > 0) {
    throw new Error(`Invalid static activity catalog:\n${errors.join('\n')}`);
  }
}

export function assertActivitySnapshotValid(snapshot: ActivitySnapshot): string[] {
  const errors: string[] = [];
  const seenTypeIds = new Set<string>();
  const seenFeedIds = new Set<string>();
  const seenHubIds = new Set<string>();

  for (const type of snapshot.activityTypes) {
    if (seenTypeIds.has(type.activityTypeId)) {
      errors.push(`Duplicate activityTypeId in snapshot: ${type.activityTypeId}`);
    }
    seenTypeIds.add(type.activityTypeId);

    const catalogEntry = STATIC_ACTIVITY_CATALOG.find((entry) => entry.extensionId === type.extensionId);
    if (!catalogEntry) {
      errors.push(`Snapshot type missing catalog match: ${type.extensionId}`);
    }
    if (!type.providerKey) {
      errors.push(`Snapshot type missing providerKey: ${type.activityTypeId}`);
    }
  }

  for (const feed of snapshot.feeds) {
    if (seenFeedIds.has(feed.feedId)) {
      errors.push(`Duplicate feedId in snapshot: ${feed.feedId}`);
    }
    seenFeedIds.add(feed.feedId);

    const catalogEntry = STATIC_ACTIVITY_CATALOG.find((entry) => entry.extensionId === feed.extensionId);
    if (!catalogEntry) {
      errors.push(`Snapshot feed missing catalog match: ${feed.extensionId}`);
    }
    if (!feed.ownerModuleId) {
      errors.push(`Snapshot feed missing ownership: ${feed.feedId}`);
    }
  }

  for (const hub of snapshot.hubs) {
    if (seenHubIds.has(hub.hubId)) {
      errors.push(`Duplicate hubId in snapshot: ${hub.hubId}`);
    }
    seenHubIds.add(hub.hubId);
  }

  const projected = resolveActivityCapabilitiesFromSnapshot(snapshot);
  if (snapshot.canViewActivity !== projected.canViewActivity) {
    errors.push('Snapshot canViewActivity capability mismatch');
  }
  if (snapshot.canViewClinicalFeed !== projected.canViewClinicalFeed) {
    errors.push('Snapshot canViewClinicalFeed capability mismatch');
  }
  if (snapshot.canViewFinancialFeed !== projected.canViewFinancialFeed) {
    errors.push('Snapshot canViewFinancialFeed capability mismatch');
  }
  if (snapshot.canViewInventoryFeed !== projected.canViewInventoryFeed) {
    errors.push('Snapshot canViewInventoryFeed capability mismatch');
  }
  if (snapshot.canViewSecurityFeed !== projected.canViewSecurityFeed) {
    errors.push('Snapshot canViewSecurityFeed capability mismatch');
  }
  if (snapshot.canViewBranchFeed !== projected.canViewBranchFeed) {
    errors.push('Snapshot canViewBranchFeed capability mismatch');
  }
  if (snapshot.canViewMyFeed !== projected.canViewMyFeed) {
    errors.push('Snapshot canViewMyFeed capability mismatch');
  }

  if (snapshot.capabilities.canViewActivity !== snapshot.canViewActivity) {
    errors.push('Snapshot capabilities object mismatch for canViewActivity');
  }

  if (!snapshot.providerKey) {
    errors.push('Snapshot missing providerKey');
  }

  if (snapshot.activitySnapshotVersion !== snapshot.view.activitySnapshotVersion) {
    errors.push('Snapshot activitySnapshotVersion mismatch between root and view');
  }

  return errors;
}
