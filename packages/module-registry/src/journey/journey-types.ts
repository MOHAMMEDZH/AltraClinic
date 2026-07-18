import type { LicensedModuleId, PermissionAction } from '../types';

export const JOURNEY_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export const JOURNEY_BUILTIN_PROVIDER_KEY = 'journey.builtin' as const;

/** Candidate licensed feature — optional on surfaces; not a new LicensedModuleId (Phase 40a). */
export const CANONICAL_JOURNEY_FEATURE_IDS = ['patientJourney'] as const;
export type CanonicalJourneyFeatureId = (typeof CANONICAL_JOURNEY_FEATURE_IDS)[number];

export type JourneyKind = 'stage' | 'transition' | 'definition' | 'surface' | 'automationHook' | 'pack';

export type JourneyCategoryId =
  | 'acquisition'
  | 'pre-visit'
  | 'clinical'
  | 'revenue'
  | 'continuity'
  | 'episode-closure';

export type JourneyStageId =
  | 'lead'
  | 'prospect'
  | 'registration'
  | 'medical-history'
  | 'appointment'
  | 'check-in'
  | 'waiting-queue'
  | 'consultation'
  | 'diagnosis'
  | 'treatment-plan'
  | 'procedures'
  | 'laboratory'
  | 'imaging'
  | 'prescription'
  | 'billing'
  | 'payment'
  | 'follow-up'
  | 'recall'
  | 'long-term-care'
  | 'discharge'
  | 're-activation';

export type JourneyTransitionType = 'happy-path' | 'side-path' | 'cancel' | 'reactivation' | 'parallel';

export type JourneyBranchScope = 'tenant' | 'branch' | 'cross-branch';

export type JourneyAutomationTriggerType = 'domain-event' | 'transition' | 'timer';

export type JourneyAutomationActionType =
  | 'create-task'
  | 'reminder'
  | 'appointment'
  | 'billing'
  | 'inventory'
  | 'communication'
  | 'ai-advisory'
  | 'external';

export type JourneyRetryBackoff = 'none' | 'exponential';

export type JourneyFailureStrategy = 'fail-closed' | 'compensate' | 'manual';

export interface JourneyRetryPolicy {
  maxAttempts: number;
  backoff: JourneyRetryBackoff;
  failClosed: true;
}

export interface JourneyFailureBehavior {
  strategy: JourneyFailureStrategy;
  failClosed: true;
}

export interface JourneyGuardFailureBehavior {
  strategy: 'fail-closed';
  failClosed: true;
}

/** Aggregate capabilities projected from EffectiveJourneyView — never UI-recomputed (SSOT §4.4). */
export const JOURNEY_AGGREGATE_CAPABILITY_IDS = [
  'canViewJourneyCenter',
  'canViewPatientJourneyStrip',
  'canViewPathwayBoard',
  'canManagePathwaySettings',
  'canPublishPathway',
  'canApproveTreatmentPlan',
  'canOverrideJourneyGuard',
  'canViewCrossBranchJourney',
  'canExportJourneyData',
  'canManageJourneyAutomations',
] as const;

export type JourneyAggregateCapabilityId = (typeof JOURNEY_AGGREGATE_CAPABILITY_IDS)[number];

export interface CanonicalJourneyCategory {
  categoryId: JourneyCategoryId;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
}

export interface CanonicalJourneyStage {
  stageId: JourneyStageId;
  localId: string;
  journeyKind: 'stage';
  categoryId: JourneyCategoryId;
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  sortOrder: number;
  tenantScoped: true;
  branchScoped: boolean;
  permissionResource: string;
  permissionAction: 'view';
  featureId?: CanonicalJourneyFeatureId;
  schemaVersion: string;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
  entryRules: readonly string[];
  exitRules: readonly string[];
  terminal: boolean;
  parallelPathAllowed: boolean;
  multiInstanceAllowed: boolean;
  deepLinkTemplate: string;
  route?: string;
}

export interface CanonicalJourneyTransition {
  transitionId: string;
  localId: string;
  journeyKind: 'transition';
  fromStageId: JourneyStageId;
  toStageId: JourneyStageId;
  transitionType: JourneyTransitionType;
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  permissionResource: string;
  permissionAction: 'update';
  requiredGuardIds: readonly string[];
  requiredApprovalIds: readonly string[];
  automationRuleIds: readonly string[];
  allowedBranchScope: 'branch';
  retry: JourneyRetryPolicy;
  failureBehavior: JourneyFailureBehavior;
  schemaVersion: string;
  labelKey: string;
  descriptionKey: string;
  deepLinkTemplate: string;
  sortOrder: number;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
  allowedCycle?: boolean;
}

export interface CanonicalJourneyGuard {
  guardId: string;
  localId: string;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  failureBehavior: JourneyGuardFailureBehavior;
  version: string;
  labelKey: string;
  descriptionKey: string;
  schemaVersion: string;
  sortOrder: number;
}

export interface CanonicalJourneyApproval {
  approvalId: string;
  localId: string;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  permissionResource: string;
  permissionAction: 'approve';
  branchScope: JourneyBranchScope;
  failureBehavior: JourneyGuardFailureBehavior;
  version: string;
  labelKey: string;
  descriptionKey: string;
  schemaVersion: string;
  sortOrder: number;
}

export interface CanonicalJourneyEscalation {
  escalationId: string;
  localId: string;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  failureBehavior: JourneyGuardFailureBehavior;
  triggerTimerId?: string;
  version: string;
  labelKey: string;
  descriptionKey: string;
  schemaVersion: string;
  sortOrder: number;
}

export interface CanonicalJourneyTimer {
  timerId: string;
  localId: string;
  slaBudgetMinutes?: number;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  failClosed: true;
  escalationId?: string;
  version: string;
  labelKey: string;
  descriptionKey: string;
  schemaVersion: string;
  sortOrder: number;
}

export interface CanonicalJourneyAutomationHook {
  automationRuleId: string;
  localId: string;
  journeyKind: 'automationHook';
  ownerModuleId: LicensedModuleId;
  moduleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  triggerType: JourneyAutomationTriggerType;
  sourceStageId?: JourneyStageId;
  sourceTransitionId?: string;
  actionType: JourneyAutomationActionType;
  targetModuleId: LicensedModuleId;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  syncIntent: 'async' | 'sync';
  idempotencyKeyStrategy: string;
  retry: JourneyRetryPolicy;
  failureBehavior: JourneyFailureBehavior;
  schemaVersion: string;
  labelKey: string;
  descriptionKey: string;
  deepLinkTemplate: string;
  sortOrder: number;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalJourneySurface {
  surfaceId: string;
  localId: string;
  journeyKind: 'surface';
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  requiredFeature?: CanonicalJourneyFeatureId;
  branchScope: JourneyBranchScope;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalJourneyDefinition {
  definitionId: string;
  localId: string;
  journeyKind: 'definition';
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  categoryId: JourneyCategoryId;
  stageIds: readonly JourneyStageId[];
  labelKey: string;
  descriptionKey: string;
  version: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  deepLinkTemplate: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalJourneyPack {
  packId: string;
  localId: string;
  journeyKind: 'pack';
  definitionId: string;
  moduleId: LicensedModuleId;
  ownerModuleId: LicensedModuleId;
  providerKey: typeof JOURNEY_BUILTIN_PROVIDER_KEY;
  labelKey: string;
  descriptionKey: string;
  version: string;
  permissionResource: string;
  permissionAction: PermissionAction;
  branchScope: JourneyBranchScope;
  deepLinkTemplate: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: typeof JOURNEY_CONTRIBUTION_SCHEMA_VERSION;
}

export type CanonicalJourneyCatalogEntry =
  | CanonicalJourneyStage
  | CanonicalJourneyTransition
  | CanonicalJourneyDefinition
  | CanonicalJourneySurface
  | CanonicalJourneyAutomationHook
  | CanonicalJourneyPack;
