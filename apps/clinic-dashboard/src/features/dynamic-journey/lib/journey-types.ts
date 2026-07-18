import type { LicensedModuleId, PermissionAction } from '@booking/module-registry';
import type { JourneyKind } from '@booking/module-registry/journey';

export type JourneyCatalogSource = 'registry' | 'static-fallback' | 'static-only' | 'restricted';

export type JourneyRegistryStatus = 'loading' | 'ready' | 'error' | 'restricted';

export interface JourneySnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  branchId: string | null;
}

export interface JourneyCategorySnapshot {
  categoryId: string;
  labelKey: string;
}

export interface JourneyStageSnapshot {
  kind: 'stage';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  stageId: string;
  categoryId: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  terminal: boolean;
  parallelPathAllowed: boolean;
  multiInstanceAllowed: boolean;
  entryRules: string[];
  exitRules: string[];
  permissionResource: string;
  permissionAction: PermissionAction | string;
  route?: string;
  deepLinkTemplate: string;
  branchScoped: boolean;
}

export interface JourneyTransitionSnapshot {
  kind: 'transition';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  transitionId: string;
  fromStageId: string;
  toStageId: string;
  transitionType: string;
  requiredGuardIds: string[];
  requiredApprovalIds: string[];
  automationRuleIds: string[];
  allowedBranchScope?: string;
  retry: {
    maxAttempts: number;
    backoff: string;
    failClosed: true;
  };
  failureBehavior: {
    strategy: string;
    failClosed: true;
  };
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface JourneyGuardSnapshot {
  kind: 'guard';
  guardId: string;
  localId: string;
  ownerModuleId: LicensedModuleId | string;
  providerKey: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
}

export interface JourneyApprovalSnapshot {
  kind: 'approval';
  approvalId: string;
  localId: string;
  ownerModuleId: LicensedModuleId | string;
  providerKey: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
}

export interface JourneyEscalationSnapshot {
  kind: 'escalation';
  escalationId: string;
  localId: string;
  ownerModuleId: LicensedModuleId | string;
  providerKey: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope: string;
  triggerTimerId?: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
}

export interface JourneyTimerSnapshot {
  kind: 'timer';
  timerId: string;
  localId: string;
  ownerModuleId: LicensedModuleId | string;
  providerKey: string;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope: string;
  slaBudgetMinutes?: number;
  escalationId?: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
}

export interface JourneyAutomationSnapshot {
  kind: 'automationHook';
  extensionId: string;
  automationRuleId: string;
  ownerModuleId: LicensedModuleId | string;
  moduleId: LicensedModuleId | string;
  triggerType: string;
  actionType: string;
  targetModuleId: LicensedModuleId | string;
  sourceStageId?: string;
  sourceTransitionId?: string;
  syncIntent?: string;
  idempotencyKeyStrategy?: string;
  retry: {
    maxAttempts: number;
    backoff: string;
    failClosed: true;
  };
  failureBehavior: {
    strategy: string;
    failClosed: true;
  };
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope?: string;
  deepLinkTemplate: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
}

export interface JourneyDefinitionSnapshot {
  kind: 'definition';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  definitionId: string;
  categoryId: string;
  stageIds: string[];
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  branchScope: string;
  deepLinkTemplate: string;
  version: string;
}

export interface JourneySurfaceSnapshot {
  kind: 'surface';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  surfaceId: string;
  route?: string;
  requiredFeature?: string;
  branchScope: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
}

export interface JourneyPackSnapshot {
  kind: 'pack';
  extensionId: string;
  moduleId: string;
  ownerModuleId: LicensedModuleId | string;
  packId: string;
  definitionId: string;
  branchScope: string;
  labelKey: string;
  descriptionKey?: string;
  sortOrder: number;
  permissionResource: string;
  permissionAction: PermissionAction | string;
  deepLinkTemplate: string;
  version: string;
}

export interface JourneyCapabilityFlags {
  canViewJourney: boolean;
  canViewPatientTimeline: boolean;
  canViewClinicalStages: boolean;
  canViewFinancialStages: boolean;
  canViewOperationalStages: boolean;
  canViewCrossBranchJourney: boolean;
  canConfigureJourney: boolean;
  canUseJourneyPacks: boolean;
  canViewAutomationMetadata: boolean;
  canViewSLAStatus: boolean;
  canViewApprovalMetadata: boolean;
}

export interface EffectiveJourneyView {
  tenantId: string;
  userId: string;
  branchId: string | null;
  accessibleCategories: JourneyCategorySnapshot[];
  accessibleStages: JourneyStageSnapshot[];
  accessibleTransitions: JourneyTransitionSnapshot[];
  accessibleDefinitions: JourneyDefinitionSnapshot[];
  accessibleSurfaces: JourneySurfaceSnapshot[];
  accessiblePacks: JourneyPackSnapshot[];
  lockedEntries: Array<{
    extensionId: string;
    reason: 'licensing' | 'permission' | 'branch' | 'reference' | 'restricted';
  }>;
  guardMetadata: JourneyGuardSnapshot[];
  approvalMetadata: JourneyApprovalSnapshot[];
  escalationMetadata: JourneyEscalationSnapshot[];
  timerAndSlaMetadata: JourneyTimerSnapshot[];
  automationMetadata: JourneyAutomationSnapshot[];
  capabilityFlags: JourneyCapabilityFlags;
  branchScope: string;
  providerOwnership: {
    providerKey: string;
  };
  snapshotVersion: string;
  source: JourneyCatalogSource;
  resolvedAt: string;
}

export interface JourneySnapshot {
  kind: 'journey';
  view: EffectiveJourneyView;
  source: JourneyCatalogSource;
  registryMode: boolean;
  registryStatus: JourneyRegistryStatus;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: JourneySnapshotIdentity;
  generatedAt: string;
  journeySnapshotVersion: string;
  journeyConfigurationVersion: string;
  providerKey: string;

  categories: JourneyCategorySnapshot[];
  stages: JourneyStageSnapshot[];
  transitions: JourneyTransitionSnapshot[];
  definitions: JourneyDefinitionSnapshot[];
  surfaces: JourneySurfaceSnapshot[];
  packs: JourneyPackSnapshot[];
  guards: JourneyGuardSnapshot[];
  approvals: JourneyApprovalSnapshot[];
  escalations: JourneyEscalationSnapshot[];
  timers: JourneyTimerSnapshot[];
  automations: JourneyAutomationSnapshot[];

  capabilities: JourneyCapabilityFlags;
  canViewJourney: boolean;
  canViewPatientTimeline: boolean;
  canViewClinicalStages: boolean;
  canViewFinancialStages: boolean;
  canViewOperationalStages: boolean;
  canViewCrossBranchJourney: boolean;
  canConfigureJourney: boolean;
  canUseJourneyPacks: boolean;
  canViewAutomationMetadata: boolean;
  canViewSLAStatus: boolean;
  canViewApprovalMetadata: boolean;
}

export interface JourneyCatalogContributionEntry {
  extensionId: string;
  journeyKind: JourneyKind;
}

