/**
 * Flexible Step 25 — governed Trial domain types.
 * Entitlement authority stays Step 16 commercial snapshot + Step 18 EER.
 */

export type SalesTrialStatus =
  | 'DRAFT'
  | 'PENDING_PROVISIONING'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CONVERTED'
  | 'CANCELLED';

/** Explicit disposition for each trial-only Add-on/Override grant at conversion. */
export type TrialGrantDisposition =
  | 'EXPIRE_ON_TRIAL_EXPIRY'
  | 'EXPIRE_ON_CONVERSION'
  | 'MIGRATE_TO_PAID_EQUIVALENT'
  | 'RETAIN_NOT_TRIAL_ONLY';

export const TRIAL_GRANT_DISPOSITIONS: readonly TrialGrantDisposition[] = [
  'EXPIRE_ON_TRIAL_EXPIRY',
  'EXPIRE_ON_CONVERSION',
  'MIGRATE_TO_PAID_EQUIVALENT',
  'RETAIN_NOT_TRIAL_ONLY',
];

export type TrialGrantKind = 'ADD_ON' | 'OVERRIDE';

/** Trial-only grant descriptor frozen on the Trial aggregate. */
export interface TrialOnlyGrant {
  grantKey: string;
  kind: TrialGrantKind;
  /** Add-on Version id or Override id when correlated to Step 15/16 records. */
  referenceId?: string | null;
  trialOnly: boolean;
}

export interface TrialGrantDispositionInput {
  grantKey: string;
  disposition: TrialGrantDisposition;
  /** Required when disposition is MIGRATE_TO_PAID_EQUIVALENT. */
  paidEquivalentKey?: string | null;
  note?: string | null;
}

export interface TrialAttributionSnapshot {
  originatingLeadId: string | null;
  ownerRepresentativeId: string | null;
  salesAttributionId: string | null;
  createdByPlatformUserId: string;
  frozenAt: string;
}

export interface SalesTrialDto {
  id: string;
  status: SalesTrialStatus;
  organizationName: string;
  platformTenantId: string | null;
  originatingLeadId: string | null;
  ownerRepresentativeId: string | null;
  trialPlanVersionId: string;
  facilityTypeKey: string;
  selectedSpecialtyKeys: string[];
  selectedModuleKeys: string[];
  startsAt: string | null;
  expiresAt: string | null;
  maxExtensions: number;
  extensionCount: number;
  commercialConfigId: string | null;
  provisioningRequestId: string | null;
  trialOnlyGrants: TrialOnlyGrant[];
  attributionSnapshot: TrialAttributionSnapshot | null;
  expiredAt: string | null;
  cancelledAt: string | null;
  cancellationReason: string | null;
  rowVersion: number;
  createdAt: string;
  updatedAt: string;
}

export interface SalesTrialExtensionDto {
  id: string;
  trialId: string;
  previousExpiresAt: string;
  newExpiresAt: string;
  extensionDays: number;
  reason: string;
  exceptional: boolean;
  actorPlatformUserId: string;
  createdAt: string;
}

export interface SalesTrialConversionDto {
  id: string;
  trialId: string;
  targetPaidPlanVersionId: string;
  dispositions: TrialGrantDispositionInput[];
  actorPlatformUserId: string;
  convertedAt: string;
  correlationId: string | null;
  outboxEventId: string | null;
  commercialConfigId: string | null;
}

export type TrialLimitState = 'CONFIGURED' | 'UNLIMITED' | 'UNCONFIGURED';

export interface TrialLimitComparison {
  canonicalKey: string;
  trialState: TrialLimitState;
  trialValue: string | null;
  paidState: TrialLimitState;
  paidValue: string | null;
  classification: 'RETAINED' | 'ADDED' | 'REMOVED' | 'CHANGED';
}

/**
 * Read-only Trial → paid comparison. Never mutates a protected SoR:
 * Trial, Subscription, Plan, PlanVersion, Entitlement, Limit, Add-on, Override,
 * Provisioning, Lifecycle, EER active snapshot.
 */
export interface TrialEntitlementPreviewDto {
  trialId: string;
  trialPlanVersionId: string;
  targetPaidPlanVersionId: string;
  retainedEntitlements: string[];
  addedEntitlements: string[];
  removedEntitlements: string[];
  limits: TrialLimitComparison[];
  trialOnlyExpiring: string[];
  trialOnlyMigrating: string[];
  incompatibilities: Array<{ reasonCode: string; message: string; subjectKey?: string }>;
  unconfiguredVsUnlimited: Array<{
    canonicalKey: string;
    trialState: TrialLimitState;
    paidState: TrialLimitState;
  }>;
  requiredDispositionGrantKeys: string[];
  runtimeSource: 'STEP16_SNAPSHOT_STEP18_EER';
  disclaimer: {
    readOnly: true;
    doesNotMutateProtectedSoR: true;
    notEntitlementDecision: true;
    notRuntimeLicenseDecision: true;
  };
}

export interface TrialExpiryRunResult {
  scanned: number;
  expired: number;
  skipped: number;
  claimConflicts: number;
  trialIds: string[];
}
