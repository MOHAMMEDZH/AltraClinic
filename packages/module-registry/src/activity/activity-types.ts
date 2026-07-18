import type { LicensedModuleId } from '../types';

export const ACTIVITY_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const ACTIVITY_BUILTIN_PROVIDER_KEY = 'activity.builtin' as const;

/** Commercial SKU reserved; optional on contributions until sales defines packaging. */
export const CANONICAL_ACTIVITY_FEATURE_IDS = ['activityCenter'] as const;
export type CanonicalActivityFeatureId = (typeof CANONICAL_ACTIVITY_FEATURE_IDS)[number];

export type ActivityKind = 'type' | 'feed' | 'hub';

export type ActivityCategoryId =
  | 'clinical'
  | 'financial'
  | 'operational'
  | 'administrative'
  | 'security'
  | 'licensing'
  | 'inventory'
  | 'communication'
  | 'workflow'
  | 'ai'
  | 'system'
  | 'branch'
  | 'branding'
  | 'other';

export type ActivitySeverity = 'info' | 'success' | 'warning' | 'critical' | 'emergency';

export type ActivityPermissionAction = 'view' | 'export';

export type ActivityBranchScope = 'tenant' | 'branch' | 'cross-branch';

export type ActivityOrderingScope = 'tenant' | 'branch' | 'feed';

/** Aggregate capabilities projected from EffectiveActivityView in Phase 38b — never UI-recomputed. */
export const ACTIVITY_AGGREGATE_CAPABILITY_IDS = [
  'canViewActivity',
  'canExportActivity',
  'canViewSecurityFeed',
  'canViewCrossBranchActivity',
  'canLinkToAudit',
] as const;

export type ActivityAggregateCapabilityId = (typeof ACTIVITY_AGGREGATE_CAPABILITY_IDS)[number];

export interface CanonicalActivityCategory {
  categoryId: ActivityCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalActivitySeverity {
  severity: ActivitySeverity;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalActivityType {
  activityTypeId: string;
  /** Synonym permanently equal to activityTypeId (H1 eventTypeId). */
  eventTypeId: string;
  localId: string;
  moduleId: LicensedModuleId;
  activityKind: 'type';
  categoryId: ActivityCategoryId;
  defaultSeverity: ActivitySeverity;
  labelKey: string;
  descriptionKey: string;
  icon?: string;
  resourceId: string;
  actions: ReadonlyArray<ActivityPermissionAction>;
  requiredFeature?: CanonicalActivityFeatureId;
  branchScoped: boolean;
  crossBranchAllowed: boolean;
  deepLinkTemplate: string;
  providerKey: typeof ACTIVITY_BUILTIN_PROVIDER_KEY;
  feedIds: ReadonlyArray<string>;
  producerEntityType: string;
  eventVersion: string;
  schemaVersion: string;
  projectionVersion: string;
  supportsCorrelation: boolean;
  supportsCausation: boolean;
  supportsParentActivity: boolean;
  supportsBatch: boolean;
  orderingScope: ActivityOrderingScope;
  retentionPolicyId: string;
  redactFields?: ReadonlyArray<string>;
  sortOrder: number;
  contributionSchemaVersion: typeof ACTIVITY_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalActivityFeed {
  feedId: string;
  localId: string;
  moduleId: LicensedModuleId;
  activityKind: 'feed';
  ownerModuleId: LicensedModuleId | 'platform';
  providerKey: typeof ACTIVITY_BUILTIN_PROVIDER_KEY;
  visibility: string;
  licensing: string;
  resourceId: string;
  actions: ReadonlyArray<ActivityPermissionAction>;
  branchScope: ActivityBranchScope;
  retentionPolicy: string;
  archivePolicy: string;
  categoryFilter?: ReadonlyArray<ActivityCategoryId>;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  requiredFeature?: CanonicalActivityFeatureId;
  sortOrder: number;
  contributionSchemaVersion: typeof ACTIVITY_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalActivityHub {
  hubId: string;
  localId: string;
  moduleId: LicensedModuleId;
  activityKind: 'hub';
  ownerModuleId: LicensedModuleId | 'platform';
  providerKey: typeof ACTIVITY_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  resourceId: string;
  actions: ReadonlyArray<ActivityPermissionAction>;
  requiredFeature?: CanonicalActivityFeatureId;
  branchScope: ActivityBranchScope;
  retentionPolicy: string;
  archivePolicy: string;
  sortOrder: number;
  contributionSchemaVersion: typeof ACTIVITY_CONTRIBUTION_SCHEMA_VERSION;
}

export type CanonicalActivitySurface = CanonicalActivityType | CanonicalActivityFeed | CanonicalActivityHub;
