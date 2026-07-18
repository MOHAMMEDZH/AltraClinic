import type { LicensedModuleId } from '@booking/module-registry';

export type ActivityCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export type ActivityKind = 'type' | 'feed' | 'hub';

export type ActivityPermissionAction = 'view' | 'export';

export interface ActivityCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  activityKind: ActivityKind;
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
  actions: Array<ActivityPermissionAction>;
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
  sortOrder: number;
  contributionSchemaVersion: 1;
}

export interface ActivitySnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
}

export interface ActivityCategorySnapshot {
  categoryId: string;
  labelKey: string;
  typeCount: number;
}

export interface ActivitySeveritySnapshot {
  severity: string;
  labelKey: string;
}

export interface ActivityTypeSnapshot {
  kind: 'type';
  extensionId: string;
  moduleId: LicensedModuleId;
  activityTypeId: string;
  eventTypeId: string;
  categoryId: string;
  defaultSeverity: string;
  labelKey: string;
  descriptionKey: string;
  deepLinkTemplate: string;
  feedIds: string[];
  providerKey: string;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  sortOrder: number;
}

export interface ActivityFeedSnapshot {
  kind: 'feed';
  extensionId: string;
  moduleId: LicensedModuleId;
  feedId: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  ownerModuleId: string;
  branchScope: string;
  providerKey: string;
  sortOrder: number;
}

export interface ActivityHubSnapshot {
  kind: 'hub';
  extensionId: string;
  moduleId: LicensedModuleId;
  hubId: string;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  ownerModuleId: string;
  providerKey: string;
  sortOrder: number;
}

export interface ActivityCapabilityFlags {
  canViewActivity: boolean;
  canViewClinicalFeed: boolean;
  canViewFinancialFeed: boolean;
  canViewInventoryFeed: boolean;
  canViewSecurityFeed: boolean;
  canViewBranchFeed: boolean;
  canViewMyFeed: boolean;
}

export interface EffectiveActivityView {
  tenantId: string;
  userId: string;
  branchId: string | null;
  feeds: ActivityFeedSnapshot[];
  accessibleTypes: ActivityTypeSnapshot[];
  lockedTypes: Array<{ activityTypeId: string; reason: 'licensing' | 'permission' | 'branch' | 'retention' }>;
  capabilities: ActivityCapabilityFlags;
  categories: ActivityCategorySnapshot[];
  severities: ActivitySeveritySnapshot[];
  hubs: ActivityHubSnapshot[];
  activitySnapshotVersion: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  source: ActivityCatalogSource;
  resolvedAt: string;
}

export interface ActivitySnapshot {
  kind: 'activity';
  view: EffectiveActivityView;
  source: ActivityCatalogSource;
  registryMode: boolean;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: ActivitySnapshotIdentity;
  generatedAt: string;
  activitySnapshotVersion: string;
  providerKey: string;
  categories: ActivityCategorySnapshot[];
  severities: ActivitySeveritySnapshot[];
  activityTypes: ActivityTypeSnapshot[];
  feeds: ActivityFeedSnapshot[];
  hubs: ActivityHubSnapshot[];
  capabilities: ActivityCapabilityFlags;
  canViewActivity: boolean;
  canViewClinicalFeed: boolean;
  canViewFinancialFeed: boolean;
  canViewInventoryFeed: boolean;
  canViewSecurityFeed: boolean;
  canViewBranchFeed: boolean;
  canViewMyFeed: boolean;
}

export interface ActivityContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  activityKind: ActivityKind;
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
  actions: Array<ActivityPermissionAction>;
  providerKey: string;
  feedIds?: string[];
  ownerModuleId?: string;
  branchScope?: string;
  branchScoped?: boolean;
  crossBranchAllowed?: boolean;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface ActivityCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  activitySnapshotVersion: string;
  moduleCount: number;
  source: ActivityCatalogSource;
}
