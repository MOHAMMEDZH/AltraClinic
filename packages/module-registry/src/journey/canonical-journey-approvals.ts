import {
  JOURNEY_BUILTIN_PROVIDER_KEY,
  type CanonicalJourneyApproval,
  type JourneyBranchScope,
} from './journey-types';
import type { LicensedModuleId } from '../types';

type ApprovalInput = {
  approvalId: string;
  ownerModuleId: LicensedModuleId;
  permissionResource: string;
  branchScope?: JourneyBranchScope;
  sortOrder: number;
};

function defineApproval(input: ApprovalInput): CanonicalJourneyApproval {
  return {
    approvalId: input.approvalId,
    localId: `approval-${input.approvalId}`,
    ownerModuleId: input.ownerModuleId,
    providerKey: JOURNEY_BUILTIN_PROVIDER_KEY,
    permissionResource: input.permissionResource,
    permissionAction: 'approve',
    branchScope: input.branchScope ?? 'branch',
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
    version: '1.0.0',
    labelKey: `journey.approval.${input.approvalId}`,
    descriptionKey: `journey.approval.${input.approvalId}.description`,
    schemaVersion: '1',
    sortOrder: input.sortOrder,
  };
}

/**
 * Canonical journey approvals — vocabulary-only (Phase 40a), not counted in ENTRY_COUNT.
 * Fail-closed by construction; not enforced at runtime in this phase.
 */
export const CANONICAL_JOURNEY_APPROVALS: readonly CanonicalJourneyApproval[] = [
  defineApproval({ approvalId: 'treatment-plan-consent', ownerModuleId: 'dental', permissionResource: 'api.dental', sortOrder: 10 }),
  defineApproval({ approvalId: 'financial-write-off', ownerModuleId: 'billing', permissionResource: 'api.billing', sortOrder: 20 }),
  defineApproval({ approvalId: 'break-glass-phi', ownerModuleId: 'emr', permissionResource: 'api.emr', branchScope: 'cross-branch', sortOrder: 30 }),
  defineApproval({ approvalId: 'pathway-publish', ownerModuleId: 'settings', permissionResource: 'api.settings', branchScope: 'tenant', sortOrder: 40 }),
  defineApproval({ approvalId: 'high-risk-automation', ownerModuleId: 'workflow', permissionResource: 'api.workflow', branchScope: 'tenant', sortOrder: 50 }),
  defineApproval({ approvalId: 'discharge-with-balance', ownerModuleId: 'billing', permissionResource: 'api.billing', sortOrder: 60 }),
] as const;

export const CANONICAL_JOURNEY_APPROVAL_COUNT = CANONICAL_JOURNEY_APPROVALS.length;
export const CANONICAL_JOURNEY_APPROVAL_IDS = CANONICAL_JOURNEY_APPROVALS.map((a) => a.approvalId);
