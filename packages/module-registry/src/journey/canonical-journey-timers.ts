import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  type CanonicalJourneyTimer,
  type JourneyBranchScope,
} from './journey-types';
import type { LicensedModuleId, PermissionAction } from '../types';

type TimerInput = {
  timerId: string;
  slaBudgetMinutes?: number;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  permissionAction?: PermissionAction;
  branchScope?: JourneyBranchScope;
  escalationId?: string;
  sortOrder: number;
};

function defineTimer(input: TimerInput): CanonicalJourneyTimer {
  return {
    timerId: input.timerId,
    localId: `timer-${input.timerId}`,
    slaBudgetMinutes: input.slaBudgetMinutes,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    permissionResource: input.permissionResource,
    permissionAction: input.permissionAction ?? 'view',
    branchScope: input.branchScope ?? 'branch',
    failClosed: true,
    escalationId: input.escalationId,
    version: '1.0.0',
    labelKey: `journey.timer.${input.timerId}`,
    descriptionKey: `journey.timer.${input.timerId}.description`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
  };
}

/**
 * Canonical journey timers / SLA budgets — vocabulary-only (Phase 40a), not counted in ENTRY_COUNT.
 * Fail-closed by construction; not enforced at runtime in this phase.
 */
export const CANONICAL_JOURNEY_TIMERS: readonly CanonicalJourneyTimer[] = [
  defineTimer({ timerId: 'waiting-queue-30m', slaBudgetMinutes: 30, ownerModuleId: 'queue', permissionResource: 'api.queue', escalationId: 'waiting-queue-sla-breach', sortOrder: 10 }),
  defineTimer({ timerId: 'consultation-start-15m', slaBudgetMinutes: 15, ownerModuleId: 'emr', permissionResource: 'api.emr', sortOrder: 20 }),
  defineTimer({ timerId: 'approval-24h', slaBudgetMinutes: 1440, ownerModuleId: 'workflow', permissionResource: 'api.workflow', escalationId: 'approval-overdue', sortOrder: 30 }),
  defineTimer({ timerId: 'payment-7d', slaBudgetMinutes: 10080, ownerModuleId: 'billing', permissionResource: 'api.billing', escalationId: 'payment-overdue', sortOrder: 40 }),
  defineTimer({ timerId: 'recall-due-90d', slaBudgetMinutes: 129600, ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 50 }),
  defineTimer({ timerId: 'follow-up-reminder-24h', slaBudgetMinutes: 1440, ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 60 }),
  defineTimer({ timerId: 'appointment-reminder-24h', slaBudgetMinutes: 1440, ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 70 }),
  defineTimer({ timerId: 'appointment-reminder-1h', slaBudgetMinutes: 60, ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', escalationId: 'no-show-escalation', sortOrder: 80 }),
] as const;

export const CANONICAL_JOURNEY_TIMER_COUNT = CANONICAL_JOURNEY_TIMERS.length;
export const CANONICAL_JOURNEY_TIMER_IDS = CANONICAL_JOURNEY_TIMERS.map((t) => t.timerId);
