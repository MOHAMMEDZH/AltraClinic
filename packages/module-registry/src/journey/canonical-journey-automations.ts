import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  type CanonicalJourneyAutomationHook,
  type JourneyAutomationActionType,
  type JourneyAutomationTriggerType,
  type JourneyBranchScope,
  type JourneyStageId,
} from './journey-types';
import type { LicensedModuleId, PermissionAction } from '../types';

type AutomationInput = {
  automationRuleId: string;
  triggerType: JourneyAutomationTriggerType;
  sourceStageId?: JourneyStageId;
  sourceTransitionId?: string;
  actionType: JourneyAutomationActionType;
  targetModuleId: LicensedModuleId;
  permissionAction?: PermissionAction;
  branchScope?: JourneyBranchScope;
  syncIntent?: 'async' | 'sync';
  sortOrder: number;
};

function defineAutomation(input: AutomationInput): CanonicalJourneyAutomationHook {
  const ownerModuleId: LicensedModuleId = 'workflow';
  return {
    automationRuleId: input.automationRuleId,
    localId: `automation-${input.automationRuleId}`,
    journeyKind: 'automationHook',
    ownerModuleId,
    moduleId: ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    triggerType: input.triggerType,
    sourceStageId: input.sourceStageId,
    sourceTransitionId: input.sourceTransitionId,
    actionType: input.actionType,
    targetModuleId: input.targetModuleId,
    permissionResource: 'api.workflow',
    permissionAction: input.permissionAction ?? 'create',
    branchScope: input.branchScope ?? 'branch',
    syncIntent: input.syncIntent ?? 'async',
    idempotencyKeyStrategy: `journey.${input.automationRuleId}.{tenantId}.{branchId}.{sourceId}`,
    retry: { maxAttempts: 3, backoff: 'exponential', failClosed: true },
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
    schemaVersion: '1',
    labelKey: `journey.automation.${input.automationRuleId}`,
    descriptionKey: `journey.automation.${input.automationRuleId}.description`,
    deepLinkTemplate: `/journey?automation=${input.automationRuleId}`,
    sortOrder: input.sortOrder,
    contributionSchemaVersion: JOURNEY_CONTRIBUTION_SCHEMA_VERSION,
  };
}

/**
 * Canonical journey automation hooks — Phase 40a foundation (10 hooks, counted in ENTRY_COUNT).
 * Zero runtime behavior: registry metadata only, owned by workflow. No execution wiring in 40a.
 */
export const CANONICAL_JOURNEY_AUTOMATIONS: readonly CanonicalJourneyAutomationHook[] = [
  defineAutomation({
    automationRuleId: 'on-patient-registered-task',
    triggerType: 'domain-event',
    sourceStageId: 'registration',
    actionType: 'create-task',
    targetModuleId: 'patients',
    sortOrder: 10,
  }),
  defineAutomation({
    automationRuleId: 'on-appointment-created-remind',
    triggerType: 'transition',
    sourceTransitionId: 'book-appointment',
    actionType: 'reminder',
    targetModuleId: 'scheduling',
    sortOrder: 20,
  }),
  defineAutomation({
    automationRuleId: 'on-checkin-verify',
    triggerType: 'transition',
    sourceTransitionId: 'check-in-patient',
    actionType: 'communication',
    targetModuleId: 'scheduling',
    sortOrder: 30,
  }),
  defineAutomation({
    automationRuleId: 'on-plan-approved-schedule',
    triggerType: 'transition',
    sourceTransitionId: 'approve-plan',
    actionType: 'appointment',
    targetModuleId: 'scheduling',
    sortOrder: 40,
  }),
  defineAutomation({
    automationRuleId: 'on-invoice-collect',
    triggerType: 'transition',
    sourceTransitionId: 'generate-invoice',
    actionType: 'billing',
    targetModuleId: 'billing',
    sortOrder: 50,
  }),
  defineAutomation({
    automationRuleId: 'on-payment-followup',
    triggerType: 'timer',
    sourceStageId: 'payment',
    actionType: 'reminder',
    targetModuleId: 'billing',
    sortOrder: 60,
  }),
  defineAutomation({
    automationRuleId: 'on-discharge-recall',
    triggerType: 'transition',
    sourceTransitionId: 'discharge-episode',
    actionType: 'appointment',
    targetModuleId: 'scheduling',
    sortOrder: 70,
  }),
  defineAutomation({
    automationRuleId: 'on-queue-sla-escalate',
    triggerType: 'timer',
    sourceStageId: 'waiting-queue',
    actionType: 'communication',
    targetModuleId: 'queue',
    sortOrder: 80,
  }),
  defineAutomation({
    automationRuleId: 'on-procedure-inventory-signal',
    triggerType: 'transition',
    sourceTransitionId: 'execute-procedure',
    actionType: 'inventory',
    targetModuleId: 'inventory',
    sortOrder: 90,
  }),
  defineAutomation({
    automationRuleId: 'on-ai-next-step-advisory',
    triggerType: 'domain-event',
    sourceStageId: 'diagnosis',
    actionType: 'ai-advisory',
    targetModuleId: 'ai',
    permissionAction: 'view',
    sortOrder: 100,
  }),
] as const;

export const CANONICAL_JOURNEY_AUTOMATION_COUNT = CANONICAL_JOURNEY_AUTOMATIONS.length;
export const CANONICAL_JOURNEY_AUTOMATION_IDS = CANONICAL_JOURNEY_AUTOMATIONS.map((a) => a.automationRuleId);
