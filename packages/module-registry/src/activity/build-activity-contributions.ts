import type { ActivityContribution, LicensedModuleId } from '../types';
import { moduleActivity } from '../builtin/extension-builders';
import { CANONICAL_ACTIVITY_TYPES } from './canonical-activity-types';
import { CANONICAL_ACTIVITY_FEEDS } from './canonical-activity-feeds';
import { CANONICAL_ACTIVITY_HUBS } from './canonical-activity-hubs';
import { CANONICAL_CROSS_MODULE_ACTIVITY } from './canonical-cross-module-activity';
import type {
  CanonicalActivityFeed,
  CanonicalActivityHub,
  CanonicalActivityType,
} from './activity-types';

function typeToContribution(type: CanonicalActivityType): ActivityContribution {
  return moduleActivity(type.moduleId, type.localId, {
    activityKind: 'type',
    activityTypeId: type.activityTypeId,
    eventTypeId: type.eventTypeId,
    categoryId: type.categoryId,
    defaultSeverity: type.defaultSeverity,
    labelKey: type.labelKey,
    descriptionKey: type.descriptionKey,
    icon: type.icon,
    sortOrder: type.sortOrder,
    actions: [...type.actions],
    requiredFeature: type.requiredFeature,
    branchScoped: type.branchScoped,
    crossBranchAllowed: type.crossBranchAllowed,
    deepLinkTemplate: type.deepLinkTemplate,
    providerKey: type.providerKey,
    feedIds: [...type.feedIds],
    producerEntityType: type.producerEntityType,
    eventVersion: type.eventVersion,
    schemaVersion: type.schemaVersion,
    projectionVersion: type.projectionVersion,
    supportsCorrelation: type.supportsCorrelation,
    supportsCausation: type.supportsCausation,
    supportsParentActivity: type.supportsParentActivity,
    supportsBatch: type.supportsBatch,
    orderingScope: type.orderingScope,
    retentionPolicyId: type.retentionPolicyId,
    redactFields: type.redactFields ? [...type.redactFields] : undefined,
    contributionSchemaVersion: type.contributionSchemaVersion,
    resourceId: type.resourceId,
  });
}

function feedToContribution(feed: CanonicalActivityFeed): ActivityContribution {
  return moduleActivity(feed.moduleId, feed.localId, {
    activityKind: 'feed',
    feedId: feed.feedId,
    ownerModuleId: feed.ownerModuleId,
    labelKey: feed.labelKey,
    descriptionKey: feed.descriptionKey,
    sortOrder: feed.sortOrder,
    actions: [...feed.actions],
    requiredFeature: feed.requiredFeature,
    deepLinkTemplate: feed.deepLinkTemplate,
    route: feed.route,
    providerKey: feed.providerKey,
    visibility: feed.visibility,
    licensing: feed.licensing,
    branchScope: feed.branchScope,
    retentionPolicy: feed.retentionPolicy,
    archivePolicy: feed.archivePolicy,
    categoryFilter: feed.categoryFilter ? [...feed.categoryFilter] : undefined,
    contributionSchemaVersion: feed.contributionSchemaVersion,
    resourceId: feed.resourceId,
  });
}

function hubToContribution(hub: CanonicalActivityHub): ActivityContribution {
  return moduleActivity(hub.moduleId, hub.localId, {
    activityKind: 'hub',
    hubId: hub.hubId,
    ownerModuleId: hub.ownerModuleId,
    labelKey: hub.labelKey,
    descriptionKey: hub.descriptionKey,
    sortOrder: hub.sortOrder,
    actions: [...hub.actions],
    requiredFeature: hub.requiredFeature,
    deepLinkTemplate: hub.deepLinkTemplate,
    route: hub.route,
    providerKey: hub.providerKey,
    branchScope: hub.branchScope,
    retentionPolicy: hub.retentionPolicy,
    archivePolicy: hub.archivePolicy,
    contributionSchemaVersion: hub.contributionSchemaVersion,
    resourceId: hub.resourceId,
  });
}

export function buildActivityContributionsForModule(moduleId: LicensedModuleId): ActivityContribution[] {
  const types = CANONICAL_ACTIVITY_TYPES.filter((entry) => entry.moduleId === moduleId).map(typeToContribution);
  const feeds = CANONICAL_ACTIVITY_FEEDS.filter((entry) => entry.moduleId === moduleId).map(feedToContribution);
  const hubs = CANONICAL_ACTIVITY_HUBS.filter((entry) => entry.moduleId === moduleId).map(hubToContribution);
  const cross = CANONICAL_CROSS_MODULE_ACTIVITY.filter((entry) => entry.moduleId === moduleId).map(
    typeToContribution,
  );
  return [...types, ...feeds, ...hubs, ...cross];
}

export function buildAllActivityContributions(): ActivityContribution[] {
  return [
    ...CANONICAL_ACTIVITY_TYPES.map(typeToContribution),
    ...CANONICAL_ACTIVITY_FEEDS.map(feedToContribution),
    ...CANONICAL_ACTIVITY_HUBS.map(hubToContribution),
    ...CANONICAL_CROSS_MODULE_ACTIVITY.map(typeToContribution),
  ];
}

export function listAllBuiltinActivityContributions(): ActivityContribution[] {
  return buildAllActivityContributions();
}
