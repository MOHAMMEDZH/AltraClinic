import {
  CANONICAL_ACTIVITY_TYPES,
  CANONICAL_ACTIVITY_FEEDS,
  CANONICAL_ACTIVITY_HUBS,
  CANONICAL_CROSS_MODULE_ACTIVITY,
  STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticActivityCatalogRuntimeAuthority,
} from '@booking/module-registry/activity';

export { STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY, isStaticActivityCatalogRuntimeAuthority };

export interface ActivityCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  activityKind: 'type' | 'feed' | 'hub';
  activityTypeId?: string;
  eventTypeId?: string;
  feedId?: string;
  hubId?: string;
  categoryId?: string;
  defaultSeverity?: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  route?: string;
  resourceId: string;
  actions: Array<'view' | 'export'>;
  providerKey: string;
  feedIds?: string[];
  ownerModuleId?: string;
  visibility?: string;
  licensing?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  retentionPolicy?: string;
  archivePolicy?: string;
  retentionPolicyId?: string;
  producerEntityType?: string;
  eventVersion?: string;
  schemaVersion?: string;
  projectionVersion?: string;
  orderingScope?: string;
  supportsCorrelation?: boolean;
  supportsCausation?: boolean;
  supportsParentActivity?: boolean;
  supportsBatch?: boolean;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

function typeToEntry(type: (typeof CANONICAL_ACTIVITY_TYPES)[number]): ActivityCatalogEntry {
  return {
    extensionId: `${type.moduleId}/activity/${type.localId}`,
    moduleId: type.moduleId,
    localId: type.localId,
    activityKind: 'type',
    activityTypeId: type.activityTypeId,
    eventTypeId: type.eventTypeId,
    categoryId: type.categoryId,
    defaultSeverity: type.defaultSeverity,
    labelKey: type.labelKey,
    descriptionKey: type.descriptionKey,
    deepLinkTemplate: type.deepLinkTemplate,
    resourceId: type.resourceId,
    actions: [...type.actions],
    providerKey: type.providerKey,
    feedIds: [...type.feedIds],
    branchScoped: type.branchScoped,
    crossBranchAllowed: type.crossBranchAllowed,
    retentionPolicyId: type.retentionPolicyId,
    producerEntityType: type.producerEntityType,
    eventVersion: type.eventVersion,
    schemaVersion: type.schemaVersion,
    projectionVersion: type.projectionVersion,
    orderingScope: type.orderingScope,
    supportsCorrelation: type.supportsCorrelation,
    supportsCausation: type.supportsCausation,
    supportsParentActivity: type.supportsParentActivity,
    supportsBatch: type.supportsBatch,
    sortOrder: type.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function feedToEntry(feed: (typeof CANONICAL_ACTIVITY_FEEDS)[number]): ActivityCatalogEntry {
  return {
    extensionId: `${feed.moduleId}/activity/${feed.localId}`,
    moduleId: feed.moduleId,
    localId: feed.localId,
    activityKind: 'feed',
    feedId: feed.feedId,
    labelKey: feed.labelKey,
    descriptionKey: feed.descriptionKey,
    deepLinkTemplate: feed.deepLinkTemplate,
    route: feed.route,
    resourceId: feed.resourceId,
    actions: [...feed.actions],
    providerKey: feed.providerKey,
    ownerModuleId: feed.ownerModuleId,
    visibility: feed.visibility,
    licensing: feed.licensing,
    branchScope: feed.branchScope,
    retentionPolicy: feed.retentionPolicy,
    archivePolicy: feed.archivePolicy,
    sortOrder: feed.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function hubToEntry(hub: (typeof CANONICAL_ACTIVITY_HUBS)[number]): ActivityCatalogEntry {
  return {
    extensionId: `${hub.moduleId}/activity/${hub.localId}`,
    moduleId: hub.moduleId,
    localId: hub.localId,
    activityKind: 'hub',
    hubId: hub.hubId,
    labelKey: hub.labelKey,
    descriptionKey: hub.descriptionKey,
    deepLinkTemplate: hub.deepLinkTemplate,
    route: hub.route,
    resourceId: hub.resourceId,
    actions: [...hub.actions],
    providerKey: hub.providerKey,
    ownerModuleId: hub.ownerModuleId,
    branchScope: hub.branchScope,
    retentionPolicy: hub.retentionPolicy,
    archivePolicy: hub.archivePolicy,
    sortOrder: hub.sortOrder,
    contributionSchemaVersion: 1,
  };
}

/** Parity baseline + Phase 38b provider pipeline — never runtime authority (`STATIC_ACTIVITY_CATALOG_IS_RUNTIME_AUTHORITY = false`). */
export const STATIC_ACTIVITY_CATALOG: readonly ActivityCatalogEntry[] = [
  ...CANONICAL_ACTIVITY_TYPES.map(typeToEntry),
  ...CANONICAL_ACTIVITY_FEEDS.map(feedToEntry),
  ...CANONICAL_ACTIVITY_HUBS.map(hubToEntry),
  ...CANONICAL_CROSS_MODULE_ACTIVITY.map(typeToEntry),
];
