import {
  CANONICAL_JOURNEY_STAGES,
  CANONICAL_JOURNEY_TRANSITIONS,
  CANONICAL_JOURNEY_DEFINITIONS,
  CANONICAL_JOURNEY_NAV_SURFACES,
  CANONICAL_JOURNEY_AUTOMATIONS,
  CANONICAL_JOURNEY_PACKS,
  STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticJourneyCatalogRuntimeAuthority,
} from '@booking/module-registry/journey';

export { STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY, isStaticJourneyCatalogRuntimeAuthority };

export interface JourneyCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  journeyKind: 'stage' | 'transition' | 'definition' | 'surface' | 'automationHook' | 'pack';
  stageId?: string;
  transitionId?: string;
  definitionId?: string;
  surfaceId?: string;
  automationRuleId?: string;
  packId?: string;
  categoryId?: string;
  ownerModuleId?: string;
  fromStageId?: string;
  toStageId?: string;
  transitionType?: string;
  terminal?: boolean;
  parallelPathAllowed?: boolean;
  multiInstanceAllowed?: boolean;
  tenantScoped?: boolean;
  branchScoped?: boolean;
  entryRules?: string[];
  exitRules?: string[];
  stageIds?: string[];
  requiredGuardIds?: string[];
  requiredApprovalIds?: string[];
  automationRuleIds?: string[];
  allowedBranchScope?: string;
  allowedCycle?: boolean;
  triggerType?: string;
  sourceStageId?: string;
  sourceTransitionId?: string;
  actionType?: string;
  targetModuleId?: string;
  syncIntent?: string;
  idempotencyKeyStrategy?: string;
  permissionResource: string;
  permissionAction: string;
  branchScope?: string;
  route?: string;
  requiredFeature?: string;
  version?: string;
  labelKey: string;
  descriptionKey?: string;
  deepLinkTemplate: string;
  providerKey: string;
  schemaVersion: string;
  sortOrder: number;
  contributionSchemaVersion: 1;
}

function stageToEntry(stage: (typeof CANONICAL_JOURNEY_STAGES)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${stage.moduleId}/journey/${stage.localId}`,
    moduleId: stage.moduleId,
    localId: stage.localId,
    journeyKind: 'stage',
    stageId: stage.stageId,
    categoryId: stage.categoryId,
    ownerModuleId: stage.ownerModuleId,
    terminal: stage.terminal,
    parallelPathAllowed: stage.parallelPathAllowed,
    multiInstanceAllowed: stage.multiInstanceAllowed,
    tenantScoped: stage.tenantScoped,
    branchScoped: stage.branchScoped,
    entryRules: [...stage.entryRules],
    exitRules: [...stage.exitRules],
    permissionResource: stage.permissionResource,
    permissionAction: stage.permissionAction,
    route: stage.route,
    labelKey: stage.labelKey,
    descriptionKey: stage.descriptionKey,
    deepLinkTemplate: stage.deepLinkTemplate,
    providerKey: stage.providerKey,
    schemaVersion: stage.schemaVersion,
    sortOrder: stage.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function transitionToEntry(transition: (typeof CANONICAL_JOURNEY_TRANSITIONS)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${transition.moduleId}/journey/${transition.localId}`,
    moduleId: transition.moduleId,
    localId: transition.localId,
    journeyKind: 'transition',
    transitionId: transition.transitionId,
    ownerModuleId: transition.ownerModuleId,
    fromStageId: transition.fromStageId,
    toStageId: transition.toStageId,
    transitionType: transition.transitionType,
    requiredGuardIds: [...transition.requiredGuardIds],
    requiredApprovalIds: [...transition.requiredApprovalIds],
    automationRuleIds: [...transition.automationRuleIds],
    allowedBranchScope: transition.allowedBranchScope,
    allowedCycle: transition.allowedCycle,
    permissionResource: transition.permissionResource,
    permissionAction: transition.permissionAction,
    labelKey: transition.labelKey,
    descriptionKey: transition.descriptionKey,
    deepLinkTemplate: transition.deepLinkTemplate,
    providerKey: transition.providerKey,
    schemaVersion: transition.schemaVersion,
    sortOrder: transition.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function definitionToEntry(definition: (typeof CANONICAL_JOURNEY_DEFINITIONS)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${definition.moduleId}/journey/${definition.localId}`,
    moduleId: definition.moduleId,
    localId: definition.localId,
    journeyKind: 'definition',
    definitionId: definition.definitionId,
    categoryId: definition.categoryId,
    ownerModuleId: definition.ownerModuleId,
    stageIds: [...definition.stageIds],
    permissionResource: definition.permissionResource,
    permissionAction: definition.permissionAction,
    branchScope: definition.branchScope,
    version: definition.version,
    labelKey: definition.labelKey,
    descriptionKey: definition.descriptionKey,
    deepLinkTemplate: definition.deepLinkTemplate,
    providerKey: definition.providerKey,
    schemaVersion: definition.schemaVersion,
    sortOrder: definition.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function surfaceToEntry(surface: (typeof CANONICAL_JOURNEY_NAV_SURFACES)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${surface.moduleId}/journey/${surface.localId}`,
    moduleId: surface.moduleId,
    localId: surface.localId,
    journeyKind: 'surface',
    surfaceId: surface.surfaceId,
    ownerModuleId: surface.ownerModuleId,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    requiredFeature: surface.requiredFeature,
    branchScope: surface.branchScope,
    route: surface.route,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    deepLinkTemplate: surface.deepLinkTemplate,
    providerKey: surface.providerKey,
    schemaVersion: surface.schemaVersion,
    sortOrder: surface.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function automationToEntry(automation: (typeof CANONICAL_JOURNEY_AUTOMATIONS)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${automation.moduleId}/journey/${automation.localId}`,
    moduleId: automation.moduleId,
    localId: automation.localId,
    journeyKind: 'automationHook',
    automationRuleId: automation.automationRuleId,
    ownerModuleId: automation.ownerModuleId,
    triggerType: automation.triggerType,
    sourceStageId: automation.sourceStageId,
    sourceTransitionId: automation.sourceTransitionId,
    actionType: automation.actionType,
    targetModuleId: automation.targetModuleId,
    branchScope: automation.branchScope,
    syncIntent: automation.syncIntent,
    idempotencyKeyStrategy: automation.idempotencyKeyStrategy,
    permissionResource: automation.permissionResource,
    permissionAction: automation.permissionAction,
    labelKey: automation.labelKey,
    descriptionKey: automation.descriptionKey,
    deepLinkTemplate: automation.deepLinkTemplate,
    providerKey: automation.providerKey,
    schemaVersion: automation.schemaVersion,
    sortOrder: automation.sortOrder,
    contributionSchemaVersion: 1,
  };
}

function packToEntry(pack: (typeof CANONICAL_JOURNEY_PACKS)[number]): JourneyCatalogEntry {
  return {
    extensionId: `${pack.moduleId}/journey/${pack.localId}`,
    moduleId: pack.moduleId,
    localId: pack.localId,
    journeyKind: 'pack',
    packId: pack.packId,
    definitionId: pack.definitionId,
    ownerModuleId: pack.ownerModuleId,
    permissionResource: pack.permissionResource,
    permissionAction: pack.permissionAction,
    branchScope: pack.branchScope,
    version: pack.version,
    labelKey: pack.labelKey,
    descriptionKey: pack.descriptionKey,
    deepLinkTemplate: pack.deepLinkTemplate,
    providerKey: pack.providerKey,
    schemaVersion: pack.schemaVersion,
    sortOrder: pack.sortOrder,
    contributionSchemaVersion: 1,
  };
}

/**
 * Parity baseline only — never runtime authority (Phase 40a/40b).
 * Runtime authority is EffectiveJourneyView via DynamicJourneyProvider.
 */
export const STATIC_JOURNEY_CATALOG: readonly JourneyCatalogEntry[] = [
  ...CANONICAL_JOURNEY_STAGES.map(stageToEntry),
  ...CANONICAL_JOURNEY_TRANSITIONS.map(transitionToEntry),
  ...CANONICAL_JOURNEY_DEFINITIONS.map(definitionToEntry),
  ...CANONICAL_JOURNEY_NAV_SURFACES.map(surfaceToEntry),
  ...CANONICAL_JOURNEY_AUTOMATIONS.map(automationToEntry),
  ...CANONICAL_JOURNEY_PACKS.map(packToEntry),
] as const;

export function assertJourneyCatalogValid(): string[] {
  const errors: string[] = [];
  if (STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY !== false) {
    errors.push('STATIC_JOURNEY_CATALOG_IS_RUNTIME_AUTHORITY must be false');
  }
  const ids = new Set<string>();
  for (const entry of STATIC_JOURNEY_CATALOG) {
    if (ids.has(entry.extensionId)) {
      errors.push(`Duplicate extensionId ${entry.extensionId}`);
    }
    ids.add(entry.extensionId);
  }
  return errors;
}
