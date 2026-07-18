import type { JourneyContribution, LicensedModuleId } from '../types';
import { moduleJourney } from '../builtin/extension-builders';
import { CANONICAL_JOURNEY_STAGES } from './canonical-journey-stages';
import { CANONICAL_JOURNEY_TRANSITIONS } from './canonical-journey-transitions';
import { CANONICAL_JOURNEY_DEFINITIONS } from './canonical-journey-definitions';
import { CANONICAL_JOURNEY_NAV_SURFACES } from './canonical-journey-surfaces';
import { CANONICAL_JOURNEY_AUTOMATIONS } from './canonical-journey-automations';
import { CANONICAL_JOURNEY_PACKS } from './canonical-journey-packs';
import type {
  CanonicalJourneyAutomationHook,
  CanonicalJourneyDefinition,
  CanonicalJourneyPack,
  CanonicalJourneyStage,
  CanonicalJourneySurface,
  CanonicalJourneyTransition,
} from './journey-types';

function stageToContribution(stage: CanonicalJourneyStage): JourneyContribution {
  return moduleJourney(stage.moduleId, stage.localId, {
    journeyKind: 'stage',
    ownerModuleId: stage.ownerModuleId,
    providerKey: stage.providerKey,
    stageId: stage.stageId,
    categoryId: stage.categoryId,
    tenantScoped: stage.tenantScoped,
    branchScoped: stage.branchScoped,
    entryRules: [...stage.entryRules],
    exitRules: [...stage.exitRules],
    terminal: stage.terminal,
    parallelPathAllowed: stage.parallelPathAllowed,
    multiInstanceAllowed: stage.multiInstanceAllowed,
    permissionResource: stage.permissionResource,
    permissionAction: stage.permissionAction,
    featureId: stage.featureId,
    labelKey: stage.labelKey,
    descriptionKey: stage.descriptionKey,
    sortOrder: stage.sortOrder,
    deepLinkTemplate: stage.deepLinkTemplate,
    route: stage.route,
    schemaVersion: stage.schemaVersion,
    contributionSchemaVersion: stage.contributionSchemaVersion,
  });
}

function transitionToContribution(transition: CanonicalJourneyTransition): JourneyContribution {
  return moduleJourney(transition.moduleId, transition.localId, {
    journeyKind: 'transition',
    ownerModuleId: transition.ownerModuleId,
    providerKey: transition.providerKey,
    transitionId: transition.transitionId,
    fromStageId: transition.fromStageId,
    toStageId: transition.toStageId,
    transitionType: transition.transitionType,
    permissionResource: transition.permissionResource,
    permissionAction: transition.permissionAction,
    requiredGuardIds: [...transition.requiredGuardIds],
    requiredApprovalIds: [...transition.requiredApprovalIds],
    automationRuleIds: [...transition.automationRuleIds],
    allowedBranchScope: transition.allowedBranchScope,
    retry: transition.retry,
    failureBehavior: transition.failureBehavior,
    allowedCycle: transition.allowedCycle,
    labelKey: transition.labelKey,
    descriptionKey: transition.descriptionKey,
    sortOrder: transition.sortOrder,
    deepLinkTemplate: transition.deepLinkTemplate,
    schemaVersion: transition.schemaVersion,
    contributionSchemaVersion: transition.contributionSchemaVersion,
  });
}

function definitionToContribution(definition: CanonicalJourneyDefinition): JourneyContribution {
  return moduleJourney(definition.moduleId, definition.localId, {
    journeyKind: 'definition',
    ownerModuleId: definition.ownerModuleId,
    providerKey: definition.providerKey,
    definitionId: definition.definitionId,
    categoryId: definition.categoryId,
    stageIds: [...definition.stageIds],
    permissionResource: definition.permissionResource,
    permissionAction: definition.permissionAction,
    branchScope: definition.branchScope,
    version: definition.version,
    labelKey: definition.labelKey,
    descriptionKey: definition.descriptionKey,
    sortOrder: definition.sortOrder,
    deepLinkTemplate: definition.deepLinkTemplate,
    schemaVersion: definition.schemaVersion,
    contributionSchemaVersion: definition.contributionSchemaVersion,
  });
}

function surfaceToContribution(surface: CanonicalJourneySurface): JourneyContribution {
  return moduleJourney(surface.moduleId, surface.localId, {
    journeyKind: 'surface',
    ownerModuleId: surface.ownerModuleId,
    providerKey: surface.providerKey,
    surfaceId: surface.surfaceId,
    route: surface.route,
    permissionResource: surface.permissionResource,
    permissionAction: surface.permissionAction,
    requiredFeature: surface.requiredFeature,
    branchScope: surface.branchScope,
    labelKey: surface.labelKey,
    descriptionKey: surface.descriptionKey,
    sortOrder: surface.sortOrder,
    deepLinkTemplate: surface.deepLinkTemplate,
    schemaVersion: surface.schemaVersion,
    contributionSchemaVersion: surface.contributionSchemaVersion,
  });
}

function automationToContribution(automation: CanonicalJourneyAutomationHook): JourneyContribution {
  return moduleJourney(automation.moduleId, automation.localId, {
    journeyKind: 'automationHook',
    ownerModuleId: automation.ownerModuleId,
    providerKey: automation.providerKey,
    automationRuleId: automation.automationRuleId,
    triggerType: automation.triggerType,
    sourceStageId: automation.sourceStageId,
    sourceTransitionId: automation.sourceTransitionId,
    actionType: automation.actionType,
    targetModuleId: automation.targetModuleId,
    permissionResource: automation.permissionResource,
    permissionAction: automation.permissionAction,
    branchScope: automation.branchScope,
    syncIntent: automation.syncIntent,
    idempotencyKeyStrategy: automation.idempotencyKeyStrategy,
    retry: automation.retry,
    failureBehavior: automation.failureBehavior,
    labelKey: automation.labelKey,
    descriptionKey: automation.descriptionKey,
    sortOrder: automation.sortOrder,
    deepLinkTemplate: automation.deepLinkTemplate,
    schemaVersion: automation.schemaVersion,
    contributionSchemaVersion: automation.contributionSchemaVersion,
  });
}

function packToContribution(pack: CanonicalJourneyPack): JourneyContribution {
  return moduleJourney(pack.moduleId, pack.localId, {
    journeyKind: 'pack',
    ownerModuleId: pack.ownerModuleId,
    providerKey: pack.providerKey,
    packId: pack.packId,
    definitionId: pack.definitionId,
    permissionResource: pack.permissionResource,
    permissionAction: pack.permissionAction,
    branchScope: pack.branchScope,
    version: pack.version,
    labelKey: pack.labelKey,
    descriptionKey: pack.descriptionKey,
    sortOrder: pack.sortOrder,
    deepLinkTemplate: pack.deepLinkTemplate,
    schemaVersion: pack.schemaVersion,
    contributionSchemaVersion: pack.contributionSchemaVersion,
  });
}

export function buildJourneyContributionsForModule(moduleId: LicensedModuleId): JourneyContribution[] {
  const stages = CANONICAL_JOURNEY_STAGES.filter((entry) => entry.moduleId === moduleId).map(stageToContribution);
  const transitions = CANONICAL_JOURNEY_TRANSITIONS.filter((entry) => entry.moduleId === moduleId).map(
    transitionToContribution,
  );
  const definitions = CANONICAL_JOURNEY_DEFINITIONS.filter((entry) => entry.moduleId === moduleId).map(
    definitionToContribution,
  );
  const surfaces = CANONICAL_JOURNEY_NAV_SURFACES.filter((entry) => entry.moduleId === moduleId).map(
    surfaceToContribution,
  );
  const automations = CANONICAL_JOURNEY_AUTOMATIONS.filter((entry) => entry.moduleId === moduleId).map(
    automationToContribution,
  );
  const packs = CANONICAL_JOURNEY_PACKS.filter((entry) => entry.moduleId === moduleId).map(packToContribution);
  return [...stages, ...transitions, ...definitions, ...surfaces, ...automations, ...packs];
}

export function buildAllJourneyContributions(): JourneyContribution[] {
  return [
    ...CANONICAL_JOURNEY_STAGES.map(stageToContribution),
    ...CANONICAL_JOURNEY_TRANSITIONS.map(transitionToContribution),
    ...CANONICAL_JOURNEY_DEFINITIONS.map(definitionToContribution),
    ...CANONICAL_JOURNEY_NAV_SURFACES.map(surfaceToContribution),
    ...CANONICAL_JOURNEY_AUTOMATIONS.map(automationToContribution),
    ...CANONICAL_JOURNEY_PACKS.map(packToContribution),
  ];
}

export function listAllBuiltinJourneyContributions(): JourneyContribution[] {
  return buildAllJourneyContributions();
}
