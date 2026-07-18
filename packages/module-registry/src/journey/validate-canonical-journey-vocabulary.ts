import { CANONICAL_JOURNEY_CATEGORIES, CANONICAL_JOURNEY_CATEGORY_IDS } from './canonical-journey-categories';
import {
  CANONICAL_JOURNEY_STAGES,
  CANONICAL_JOURNEY_STAGE_COUNT,
  CANONICAL_JOURNEY_STAGE_IDS,
} from './canonical-journey-stages';
import {
  CANONICAL_JOURNEY_TRANSITIONS,
  CANONICAL_JOURNEY_TRANSITION_COUNT,
} from './canonical-journey-transitions';
import { CANONICAL_JOURNEY_GUARDS, CANONICAL_JOURNEY_GUARD_IDS } from './canonical-journey-guards';
import { CANONICAL_JOURNEY_APPROVALS, CANONICAL_JOURNEY_APPROVAL_IDS } from './canonical-journey-approvals';
import { CANONICAL_JOURNEY_ESCALATIONS, CANONICAL_JOURNEY_ESCALATION_IDS } from './canonical-journey-escalations';
import { CANONICAL_JOURNEY_TIMERS, CANONICAL_JOURNEY_TIMER_IDS } from './canonical-journey-timers';
import {
  CANONICAL_JOURNEY_AUTOMATIONS,
  CANONICAL_JOURNEY_AUTOMATION_COUNT,
} from './canonical-journey-automations';
import {
  CANONICAL_JOURNEY_DEFINITIONS,
  CANONICAL_JOURNEY_DEFINITION_COUNT,
} from './canonical-journey-definitions';
import {
  CANONICAL_JOURNEY_NAV_SURFACES,
  CANONICAL_JOURNEY_NAV_SURFACE_COUNT,
  CANONICAL_JOURNEY_ENTRY_COUNT,
  CANONICAL_JOURNEY_SURFACE_IDS,
} from './canonical-journey-surfaces';
import { CANONICAL_JOURNEY_PACKS, CANONICAL_JOURNEY_PACK_COUNT } from './canonical-journey-packs';
import { JOURNEY_BUILTIN_PROVIDER_KEY, CANONICAL_JOURNEY_FEATURE_IDS } from './journey-types';

const STAGE_IDS = new Set(CANONICAL_JOURNEY_STAGE_IDS);
const CATEGORY_IDS = new Set(CANONICAL_JOURNEY_CATEGORY_IDS);
const GUARD_IDS = new Set(CANONICAL_JOURNEY_GUARD_IDS);
const APPROVAL_IDS = new Set(CANONICAL_JOURNEY_APPROVAL_IDS);
const ESCALATION_IDS = new Set(CANONICAL_JOURNEY_ESCALATION_IDS);
const TIMER_IDS = new Set(CANONICAL_JOURNEY_TIMER_IDS);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_JOURNEY_FEATURE_IDS);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;
const VALID_PERMISSION_ACTIONS = new Set(['view', 'create', 'update', 'delete', 'approve', 'export', 'manage']);
const TERMINAL_STAGE_IDS = new Set(['discharge']);
const PARALLEL_STAGE_IDS = new Set(['laboratory', 'imaging', 'prescription']);

/** Fail-closed validation of canonical journey vocabulary (Phase 40a). Metadata only. */
export function validateCanonicalJourneyVocabulary(): string[] {
  const errors: string[] = [];

  if (CANONICAL_JOURNEY_CATEGORIES.length !== 6) {
    errors.push(`Canonical journey category count must be 6 (got ${CANONICAL_JOURNEY_CATEGORIES.length})`);
  }
  if (CANONICAL_JOURNEY_STAGE_COUNT !== 21) {
    errors.push(`Canonical journey stage count must be 21 (got ${CANONICAL_JOURNEY_STAGE_COUNT})`);
  }
  if (CANONICAL_JOURNEY_TRANSITION_COUNT !== 22) {
    errors.push(`Canonical journey transition count must be 22 (got ${CANONICAL_JOURNEY_TRANSITION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_DEFINITION_COUNT !== 4) {
    errors.push(`Canonical journey definition count must be 4 (got ${CANONICAL_JOURNEY_DEFINITION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_NAV_SURFACE_COUNT !== 4) {
    errors.push(`Canonical journey surface count must be 4 (got ${CANONICAL_JOURNEY_NAV_SURFACE_COUNT})`);
  }
  if (CANONICAL_JOURNEY_AUTOMATION_COUNT !== 10) {
    errors.push(`Canonical journey automation hook count must be 10 (got ${CANONICAL_JOURNEY_AUTOMATION_COUNT})`);
  }
  if (CANONICAL_JOURNEY_PACK_COUNT !== 4) {
    errors.push(`Canonical journey pack count must be 4 (got ${CANONICAL_JOURNEY_PACK_COUNT})`);
  }
  if (CANONICAL_JOURNEY_ENTRY_COUNT !== 65) {
    errors.push(`Canonical journey entry count must be 65 (got ${CANONICAL_JOURNEY_ENTRY_COUNT})`);
  }
  if (CANONICAL_JOURNEY_GUARDS.length !== 12) {
    errors.push(`Canonical journey guard count must be 12 (got ${CANONICAL_JOURNEY_GUARDS.length})`);
  }
  if (CANONICAL_JOURNEY_APPROVALS.length !== 6) {
    errors.push(`Canonical journey approval count must be 6 (got ${CANONICAL_JOURNEY_APPROVALS.length})`);
  }
  if (CANONICAL_JOURNEY_ESCALATIONS.length !== 5) {
    errors.push(`Canonical journey escalation count must be 5 (got ${CANONICAL_JOURNEY_ESCALATIONS.length})`);
  }
  if (CANONICAL_JOURNEY_TIMERS.length !== 8) {
    errors.push(`Canonical journey timer count must be 8 (got ${CANONICAL_JOURNEY_TIMERS.length})`);
  }

  if (new Set(CANONICAL_JOURNEY_CATEGORY_IDS).size !== CANONICAL_JOURNEY_CATEGORY_IDS.length) {
    errors.push('Duplicate journey categoryId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_STAGE_IDS).size !== CANONICAL_JOURNEY_STAGE_IDS.length) {
    errors.push('Duplicate journey stageId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_GUARD_IDS).size !== CANONICAL_JOURNEY_GUARD_IDS.length) {
    errors.push('Duplicate journey guardId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_APPROVAL_IDS).size !== CANONICAL_JOURNEY_APPROVAL_IDS.length) {
    errors.push('Duplicate journey approvalId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_ESCALATION_IDS).size !== CANONICAL_JOURNEY_ESCALATION_IDS.length) {
    errors.push('Duplicate journey escalationId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_TIMER_IDS).size !== CANONICAL_JOURNEY_TIMER_IDS.length) {
    errors.push('Duplicate journey timerId in vocabulary');
  }
  if (new Set(CANONICAL_JOURNEY_SURFACE_IDS).size !== CANONICAL_JOURNEY_SURFACE_IDS.length) {
    errors.push('Duplicate journey surfaceId in vocabulary');
  }

  const seenLocalIds = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenExtensionIds = new Map<string, string>();
  const seenStageIds = new Map<string, string>();

  const stageInDegree = new Map<string, number>();
  const stageOutDegree = new Map<string, number>();
  for (const stageId of STAGE_IDS) {
    stageInDegree.set(stageId, 0);
    stageOutDegree.set(stageId, 0);
  }

  for (const stage of CANONICAL_JOURNEY_STAGES) {
    const owner = `${stage.moduleId}/journey/${stage.localId}`;

    const priorStage = seenStageIds.get(stage.stageId);
    if (priorStage) {
      errors.push(`Duplicate stageId "${stage.stageId}" (${priorStage} and ${owner})`);
    } else {
      seenStageIds.set(stage.stageId, owner);
    }

    const priorLocal = seenLocalIds.get(`${stage.moduleId}::${stage.localId}`);
    if (priorLocal) {
      errors.push(`Duplicate journey localId "${stage.localId}" within module (${priorLocal} and ${owner})`);
    } else {
      seenLocalIds.set(`${stage.moduleId}::${stage.localId}`, owner);
    }

    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate journey extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }

    if (!CATEGORY_IDS.has(stage.categoryId)) {
      errors.push(`Stage ${owner} has invalid category "${stage.categoryId}"`);
    }
    if (stage.moduleId !== stage.ownerModuleId) {
      errors.push(`Stage ${owner} moduleId must equal ownerModuleId`);
    }
    if (stage.providerKey !== JOURNEY_BUILTIN_PROVIDER_KEY || !PROVIDER_KEY_PATTERN.test(stage.providerKey)) {
      errors.push(`Stage ${owner} has invalid providerKey "${stage.providerKey}"`);
    }
    if (!stage.permissionResource?.startsWith('api.')) {
      errors.push(`Stage ${owner} has invalid permissionResource "${stage.permissionResource}"`);
    }
    if (stage.permissionAction !== 'view') {
      errors.push(`Stage ${owner} permissionAction must be "view"`);
    }
    if (stage.tenantScoped !== true) {
      errors.push(`Stage ${owner} must be tenantScoped`);
    }
    if (typeof stage.branchScoped !== 'boolean') {
      errors.push(`Stage ${owner} missing branchScoped`);
    }
    if (stage.featureId && !VALID_FEATURE_IDS.has(stage.featureId)) {
      errors.push(`Stage ${owner} has invalid featureId "${stage.featureId}"`);
    }
    const expectedTerminal = TERMINAL_STAGE_IDS.has(stage.stageId);
    if (stage.terminal !== expectedTerminal) {
      errors.push(`Stage ${owner} terminal must be ${expectedTerminal}`);
    }
    const expectedParallel = PARALLEL_STAGE_IDS.has(stage.stageId);
    if (stage.parallelPathAllowed !== expectedParallel) {
      errors.push(`Stage ${owner} parallelPathAllowed must be ${expectedParallel}`);
    }
    if (typeof stage.multiInstanceAllowed !== 'boolean') {
      errors.push(`Stage ${owner} missing multiInstanceAllowed`);
    }
    if (!stage.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Stage ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(stage.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${stage.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(stage.deepLinkTemplate, owner);
      }
    }
    if (stage.route) {
      const priorRoute = seenRoutes.get(stage.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${stage.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(stage.route, owner);
      }
    }
    if (!Array.isArray(stage.entryRules) || !Array.isArray(stage.exitRules)) {
      errors.push(`Stage ${owner} must declare entryRules/exitRules arrays`);
    }
    if (stage.schemaVersion !== '1') {
      errors.push(`Stage ${owner} schemaVersion must be "1"`);
    }
  }

  if (CANONICAL_JOURNEY_STAGE_COUNT !== 21 || STAGE_IDS.size !== 21) {
    errors.push(`Canonical journey stage set must contain exactly 21 unique stageIds (got ${STAGE_IDS.size})`);
  }

  const seenTransitionIds = new Map<string, string>();
  for (const transition of CANONICAL_JOURNEY_TRANSITIONS) {
    const owner = `${transition.moduleId}/journey/${transition.localId}`;

    const priorTransition = seenTransitionIds.get(transition.transitionId);
    if (priorTransition) {
      errors.push(`Duplicate transitionId "${transition.transitionId}" (${priorTransition} and ${owner})`);
    } else {
      seenTransitionIds.set(transition.transitionId, owner);
    }

    const priorLocal = seenLocalIds.get(`${transition.moduleId}::${transition.localId}`);
    if (priorLocal) {
      errors.push(`Duplicate journey localId "${transition.localId}" within module (${priorLocal} and ${owner})`);
    } else {
      seenLocalIds.set(`${transition.moduleId}::${transition.localId}`, owner);
    }

    if (!STAGE_IDS.has(transition.fromStageId)) {
      errors.push(`Transition ${owner} references invalid fromStageId "${transition.fromStageId}"`);
    } else {
      stageOutDegree.set(transition.fromStageId, (stageOutDegree.get(transition.fromStageId) ?? 0) + 1);
    }
    if (!STAGE_IDS.has(transition.toStageId)) {
      errors.push(`Transition ${owner} references invalid toStageId "${transition.toStageId}"`);
    } else {
      stageInDegree.set(transition.toStageId, (stageInDegree.get(transition.toStageId) ?? 0) + 1);
    }
    if (transition.moduleId !== transition.ownerModuleId) {
      errors.push(`Transition ${owner} moduleId must equal ownerModuleId`);
    }
    if (transition.providerKey !== JOURNEY_BUILTIN_PROVIDER_KEY) {
      errors.push(`Transition ${owner} has invalid providerKey`);
    }
    if (!transition.permissionResource?.startsWith('api.')) {
      errors.push(`Transition ${owner} has invalid permissionResource`);
    }
    if (transition.permissionAction !== 'update') {
      errors.push(`Transition ${owner} permissionAction must be "update"`);
    }
    if (transition.allowedBranchScope !== 'branch') {
      errors.push(`Transition ${owner} allowedBranchScope must be "branch"`);
    }
    if (transition.retry?.failClosed !== true) {
      errors.push(`Transition ${owner} retry must declare failClosed=true`);
    }
    if (transition.failureBehavior?.failClosed !== true) {
      errors.push(`Transition ${owner} failureBehavior must declare failClosed=true`);
    }
    for (const guardId of transition.requiredGuardIds) {
      if (!GUARD_IDS.has(guardId)) {
        errors.push(`Transition ${owner} references invalid guardId "${guardId}"`);
      }
    }
    for (const approvalId of transition.requiredApprovalIds) {
      if (!APPROVAL_IDS.has(approvalId)) {
        errors.push(`Transition ${owner} references invalid approvalId "${approvalId}"`);
      }
    }
    if (!transition.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Transition ${owner} deepLinkTemplate must start with "/"`);
    }
    if (transition.schemaVersion !== '1') {
      errors.push(`Transition ${owner} schemaVersion must be "1"`);
    }
  }

  for (const [stageId, outDegree] of stageOutDegree.entries()) {
    const inDegree = stageInDegree.get(stageId) ?? 0;
    if (outDegree === 0 && inDegree === 0) {
      errors.push(`Orphan journey stage "${stageId}" has no incoming or outgoing transitions`);
    }
  }

  for (const guard of CANONICAL_JOURNEY_GUARDS) {
    const owner = `guard:${guard.guardId}`;
    if (guard.failureBehavior?.failClosed !== true) {
      errors.push(`Guard ${owner} must declare failClosed=true`);
    }
    if (guard.providerKey !== JOURNEY_BUILTIN_PROVIDER_KEY) {
      errors.push(`Guard ${owner} has invalid providerKey`);
    }
    if (!guard.permissionResource?.startsWith('api.')) {
      errors.push(`Guard ${owner} has invalid permissionResource`);
    }
    if (!VALID_PERMISSION_ACTIONS.has(guard.permissionAction)) {
      errors.push(`Guard ${owner} has invalid permissionAction`);
    }
    if (!guard.version || !SEMVER_PATTERN.test(guard.version)) {
      errors.push(`Guard ${owner} has invalid version`);
    }
  }

  for (const approval of CANONICAL_JOURNEY_APPROVALS) {
    const owner = `approval:${approval.approvalId}`;
    if (approval.failureBehavior?.failClosed !== true) {
      errors.push(`Approval ${owner} must declare failClosed=true`);
    }
    if (approval.permissionAction !== 'approve') {
      errors.push(`Approval ${owner} permissionAction must be "approve"`);
    }
    if (!approval.version || !SEMVER_PATTERN.test(approval.version)) {
      errors.push(`Approval ${owner} has invalid version`);
    }
  }

  for (const escalation of CANONICAL_JOURNEY_ESCALATIONS) {
    const owner = `escalation:${escalation.escalationId}`;
    if (escalation.failureBehavior?.failClosed !== true) {
      errors.push(`Escalation ${owner} must declare failClosed=true`);
    }
    if (escalation.triggerTimerId && !TIMER_IDS.has(escalation.triggerTimerId)) {
      errors.push(`Escalation ${owner} references invalid triggerTimerId "${escalation.triggerTimerId}"`);
    }
    if (!escalation.version || !SEMVER_PATTERN.test(escalation.version)) {
      errors.push(`Escalation ${owner} has invalid version`);
    }
  }

  for (const timer of CANONICAL_JOURNEY_TIMERS) {
    const owner = `timer:${timer.timerId}`;
    if (timer.failClosed !== true) {
      errors.push(`Timer ${owner} must declare failClosed=true`);
    }
    if (timer.slaBudgetMinutes !== undefined && timer.slaBudgetMinutes <= 0) {
      errors.push(`Timer ${owner} slaBudgetMinutes must be positive when declared`);
    }
    if (timer.escalationId && !ESCALATION_IDS.has(timer.escalationId)) {
      errors.push(`Timer ${owner} references invalid escalationId "${timer.escalationId}"`);
    }
    if (!timer.version || !SEMVER_PATTERN.test(timer.version)) {
      errors.push(`Timer ${owner} has invalid version`);
    }
  }

  const seenAutomationIds = new Map<string, string>();
  for (const automation of CANONICAL_JOURNEY_AUTOMATIONS) {
    const owner = `${automation.moduleId}/journey/${automation.localId}`;

    const priorAutomation = seenAutomationIds.get(automation.automationRuleId);
    if (priorAutomation) {
      errors.push(`Duplicate automationRuleId "${automation.automationRuleId}" (${priorAutomation} and ${owner})`);
    } else {
      seenAutomationIds.set(automation.automationRuleId, owner);
    }
    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate journey extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }
    if (automation.sourceStageId && !STAGE_IDS.has(automation.sourceStageId)) {
      errors.push(`Automation ${owner} references invalid sourceStageId "${automation.sourceStageId}"`);
    }
    if (automation.retry?.failClosed !== true) {
      errors.push(`Automation ${owner} retry must declare failClosed=true`);
    }
    if (automation.failureBehavior?.failClosed !== true) {
      errors.push(`Automation ${owner} failureBehavior must declare failClosed=true`);
    }
    if (!automation.idempotencyKeyStrategy) {
      errors.push(`Automation ${owner} missing idempotencyKeyStrategy`);
    }
    if (!automation.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Automation ${owner} deepLinkTemplate must start with "/"`);
    }
  }

  const seenDefinitionIds = new Map<string, string>();
  for (const definition of CANONICAL_JOURNEY_DEFINITIONS) {
    const owner = `${definition.moduleId}/journey/${definition.localId}`;
    const priorDefinition = seenDefinitionIds.get(definition.definitionId);
    if (priorDefinition) {
      errors.push(`Duplicate definitionId "${definition.definitionId}" (${priorDefinition} and ${owner})`);
    } else {
      seenDefinitionIds.set(definition.definitionId, owner);
    }
    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate journey extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }
    if (!definition.stageIds.length) {
      errors.push(`Definition ${owner} must declare at least one stageId`);
    }
    for (const stageId of definition.stageIds) {
      if (!STAGE_IDS.has(stageId)) {
        errors.push(`Definition ${owner} references invalid stageId "${stageId}"`);
      }
    }
  }

  const seenSurfaceIds = new Map<string, string>();
  for (const surface of CANONICAL_JOURNEY_NAV_SURFACES) {
    const owner = `${surface.moduleId}/journey/${surface.localId}`;
    const priorSurface = seenSurfaceIds.get(surface.surfaceId);
    if (priorSurface) {
      errors.push(`Duplicate surfaceId "${surface.surfaceId}" (${priorSurface} and ${owner})`);
    } else {
      seenSurfaceIds.set(surface.surfaceId, owner);
    }
    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate journey extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }
    if (!surface.route?.startsWith('/')) {
      errors.push(`Surface ${owner} has invalid route`);
    } else {
      const priorRoute = seenRoutes.get(surface.route);
      if (priorRoute) {
        errors.push(`Duplicate route "${surface.route}" (${priorRoute} and ${owner})`);
      } else {
        seenRoutes.set(surface.route, owner);
      }
    }
    if (!surface.deepLinkTemplate?.startsWith('/')) {
      errors.push(`Surface ${owner} deepLinkTemplate must start with "/"`);
    } else {
      const prior = seenDeepLinks.get(surface.deepLinkTemplate);
      if (prior) {
        errors.push(`Duplicate deepLinkTemplate "${surface.deepLinkTemplate}" (${prior} and ${owner})`);
      } else {
        seenDeepLinks.set(surface.deepLinkTemplate, owner);
      }
    }
    if (surface.requiredFeature && !VALID_FEATURE_IDS.has(surface.requiredFeature)) {
      errors.push(`Surface ${owner} has invalid featureId`);
    }
  }

  const seenPackIds = new Map<string, string>();
  const definitionIds = new Set(seenDefinitionIds.keys());
  for (const pack of CANONICAL_JOURNEY_PACKS) {
    const owner = `${pack.moduleId}/journey/${pack.localId}`;
    const priorPack = seenPackIds.get(pack.packId);
    if (priorPack) {
      errors.push(`Duplicate packId "${pack.packId}" (${priorPack} and ${owner})`);
    } else {
      seenPackIds.set(pack.packId, owner);
    }
    if (seenExtensionIds.has(owner)) {
      errors.push(`Duplicate journey extensionId "${owner}"`);
    } else {
      seenExtensionIds.set(owner, owner);
    }
    if (!definitionIds.has(pack.definitionId)) {
      errors.push(`Pack ${owner} references invalid definitionId "${pack.definitionId}"`);
    }
  }

  return errors;
}
