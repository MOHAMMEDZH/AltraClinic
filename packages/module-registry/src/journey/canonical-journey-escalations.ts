import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  type CanonicalJourneyEscalation,
  type JourneyBranchScope,
} from './journey-types';
import type { LicensedModuleId, PermissionAction } from '../types';

type EscalationInput = {
  escalationId: string;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  permissionAction?: PermissionAction;
  branchScope?: JourneyBranchScope;
  triggerTimerId?: string;
  sortOrder: number;
};

function defineEscalation(input: EscalationInput): CanonicalJourneyEscalation {
  return {
    escalationId: input.escalationId,
    localId: `escalation-${input.escalationId}`,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    permissionResource: input.permissionResource,
    permissionAction: input.permissionAction ?? 'manage',
    branchScope: input.branchScope ?? 'branch',
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
    triggerTimerId: input.triggerTimerId,
    version: '1.0.0',
    labelKey: `journey.escalation.${input.escalationId}`,
    descriptionKey: `journey.escalation.${input.escalationId}.description`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
  };
}

/**
 * Canonical journey escalations — vocabulary-only (Phase 40a), not counted in ENTRY_COUNT.
 * Fail-closed by construction; not enforced at runtime in this phase.
 */
export const CANONICAL_JOURNEY_ESCALATIONS: readonly CanonicalJourneyEscalation[] = [
  defineEscalation({ escalationId: 'waiting-queue-sla-breach', ownerModuleId: 'queue', permissionResource: 'api.queue', triggerTimerId: 'waiting-queue-30m', sortOrder: 10 }),
  defineEscalation({ escalationId: 'approval-overdue', ownerModuleId: 'workflow', permissionResource: 'api.workflow', triggerTimerId: 'approval-24h', sortOrder: 20 }),
  defineEscalation({ escalationId: 'payment-overdue', ownerModuleId: 'billing', permissionResource: 'api.billing', triggerTimerId: 'payment-7d', sortOrder: 30 }),
  defineEscalation({ escalationId: 'no-show-escalation', ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 40 }),
  defineEscalation({ escalationId: 'automation-dead-letter', ownerModuleId: 'workflow', permissionResource: 'api.workflow', sortOrder: 50 }),
] as const;

export const CANONICAL_JOURNEY_ESCALATION_COUNT = CANONICAL_JOURNEY_ESCALATIONS.length;
export const CANONICAL_JOURNEY_ESCALATION_IDS = CANONICAL_JOURNEY_ESCALATIONS.map((e) => e.escalationId);
