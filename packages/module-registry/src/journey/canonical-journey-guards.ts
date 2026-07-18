import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  type CanonicalJourneyGuard,
  type JourneyBranchScope,
} from './journey-types';
import type { LicensedModuleId, PermissionAction } from '../types';

type GuardInput = {
  guardId: string;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  permissionAction?: PermissionAction;
  branchScope?: JourneyBranchScope;
  sortOrder: number;
};

function defineGuard(input: GuardInput): CanonicalJourneyGuard {
  return {
    guardId: input.guardId,
    localId: `guard-${input.guardId}`,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    permissionResource: input.permissionResource,
    permissionAction: input.permissionAction ?? 'view',
    branchScope: input.branchScope ?? 'branch',
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
    version: '1.0.0',
    labelKey: `journey.guard.${input.guardId}`,
    descriptionKey: `journey.guard.${input.guardId}.description`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
  };
}

/**
 * Canonical journey guards — vocabulary-only (Phase 40a), not counted in ENTRY_COUNT.
 * Fail-closed by construction; not enforced at runtime in this phase.
 */
export const CANONICAL_JOURNEY_GUARDS: readonly CanonicalJourneyGuard[] = [
  defineGuard({ guardId: 'patient-registered', ownerModuleId: 'patients', permissionResource: 'api.patients', sortOrder: 10 }),
  defineGuard({ guardId: 'medical-history-complete', ownerModuleId: 'emr', permissionResource: 'api.emr', sortOrder: 20 }),
  defineGuard({ guardId: 'appointment-confirmed', ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 30 }),
  defineGuard({ guardId: 'clinician-assigned', ownerModuleId: 'emr', permissionResource: 'api.emr', sortOrder: 40 }),
  defineGuard({ guardId: 'diagnosis-recorded', ownerModuleId: 'emr', permissionResource: 'api.emr', sortOrder: 50 }),
  defineGuard({ guardId: 'treatment-plan-approved', ownerModuleId: 'dental', permissionResource: 'api.dental', permissionAction: 'approve', sortOrder: 60 }),
  defineGuard({ guardId: 'invoice-issued', ownerModuleId: 'billing', permissionResource: 'api.billing', sortOrder: 70 }),
  defineGuard({ guardId: 'payment-status-valid', ownerModuleId: 'billing', permissionResource: 'api.billing', sortOrder: 80 }),
  defineGuard({ guardId: 'follow-up-due', ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 90 }),
  defineGuard({ guardId: 'recall-overdue', ownerModuleId: 'scheduling', permissionResource: 'api.scheduling', sortOrder: 100 }),
  defineGuard({ guardId: 'consent-captured', ownerModuleId: 'patients', permissionResource: 'api.patients', sortOrder: 110 }),
  defineGuard({ guardId: 'branch-accessible', ownerModuleId: 'settings', permissionResource: 'api.settings', branchScope: 'cross-branch', sortOrder: 120 }),
] as const;

export const CANONICAL_JOURNEY_GUARD_COUNT = CANONICAL_JOURNEY_GUARDS.length;
export const CANONICAL_JOURNEY_GUARD_IDS = CANONICAL_JOURNEY_GUARDS.map((g) => g.guardId);
