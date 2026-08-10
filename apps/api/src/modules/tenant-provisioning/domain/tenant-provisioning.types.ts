/**
 * Flexible Step 17 — Tenant Creation and Provisioning domain types.
 * Workflow state is independent of PlatformTenantStatus / Tenant lifecycle (Step 19).
 */

export const PROVISIONING_STATUSES = [
  'REQUESTED',
  'VALIDATING',
  'READY',
  'PROVISIONING',
  'AWAITING_ACTIVATION',
  'COMPLETED',
  'FAILED_RETRYABLE',
  'FAILED_TERMINAL',
  'COMPENSATING',
  'COMPENSATED',
  'CANCELLED_BEFORE_ACTIVATION',
] as const;

export type ProvisioningStatus = (typeof PROVISIONING_STATUSES)[number];

export const PROVISIONING_CHECKPOINTS = [
  'request_accepted',
  'validation_completed',
  'tenant_identity_reserved',
  'tenant_registry_created',
  'initial_tenant_configuration_created',
  'facility_type_assigned',
  'specialties_assigned',
  'commercial_configuration_prepared',
  'add_ons_assigned',
  'entitlement_preview_frozen',
  'tenant_resources_provisioned',
  'enabled_modules_provisioned',
  'initial_limit_integration_completed',
  'administrator_invitation_prepared',
  'activation_prerequisites_confirmed',
  'commercial_activation_completed',
  'eer_verification_completed',
  'tenant_onboarding_activation_completed',
  'administrator_invitation_dispatched',
  'workflow_completed',
] as const;

export type ProvisioningCheckpointKey = (typeof PROVISIONING_CHECKPOINTS)[number];

export const PROVISIONING_OPERATIONS = [
  'CREATE_PROVISIONING_REQUEST',
  'START_PROVISIONING',
  'RETRY_PROVISIONING',
  'COMPENSATE_PROVISIONING',
  'FINALIZE_ONBOARDING_ACTIVATION',
] as const;

export type ProvisioningOperation = (typeof PROVISIONING_OPERATIONS)[number];

export type OnboardingType = 'STANDARD' | 'TRIAL_REQUEST';

export type AddOnSelectionInput = {
  addOnId: string;
  quantity?: string;
  effectiveFrom?: string;
  effectiveUntil?: string;
};

export type TenantProvisioningRequestInput = {
  organization: {
    legalOrDisplayName: string;
    requestedSlug?: string;
    regionOrEnvironment?: string;
    timezone?: string;
  };
  facilityTypeKey: string;
  specialtyKeys: string[];
  publishedPlanVersionId: string;
  addOnSelections?: AddOnSelectionInput[];
  tenantAdmin: {
    email: string;
    displayName?: string;
    locale?: string;
  };
  onboardingType: OnboardingType;
  requestedStartAt?: string;
  salesAttributionId?: string;
  externalRequestId?: string;
};

export type ProvisioningValidationIssue = {
  code: string;
  field?: string;
  catalogKey?: string;
};

export type ProvisioningValidationResult = {
  valid: boolean;
  errors: ProvisioningValidationIssue[];
  warnings: ProvisioningValidationIssue[];
  previewFingerprint?: string;
  compatibilityFingerprint?: string;
  derivedModuleKeys?: string[];
  planKey?: string;
  planVersionId?: string;
};

export type ProvisioningProgressDto = {
  id: string;
  status: ProvisioningStatus;
  rowVersion: number;
  organizationName: string;
  facilityTypeKey: string;
  specialtyKeys: string[];
  publishedPlanVersionId: string;
  onboardingType: OnboardingType;
  tenantId: string | null;
  platformTenantId: string | null;
  commercialConfigId: string | null;
  previewFingerprint: string | null;
  lastErrorCode: string | null;
  checkpoints: Array<{
    key: string;
    status: string;
    completedAt: string | null;
  }>;
  createdAt: string;
  updatedAt: string;
};

export class TenantProvisioningError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number = 400,
  ) {
    super(message);
    this.name = 'TenantProvisioningError';
  }
}

/**
 * Test-only failure injection points (never registered in production).
 * F01–F33 final acceptance aliases — keep legacy aliases for older suites.
 */
export type ProvisioningFailureInjectionPoint =
  | 'after_validation' // F01
  | 'after_idempotency_claim' // F02
  | 'after_workflow_row_creation' // F03
  | 'after_tenant_slug_reservation' // F04
  | 'after_tenant_registry' // F05
  | 'after_initial_tenant_settings' // F06
  | 'after_facility_assignment' // F07
  | 'after_specialty_assignment' // F08
  | 'after_commercial_configuration' // F09
  | 'after_addon_assignment' // F10
  | 'after_entitlement_preview_persistence' // F11
  | 'during_first_module_provisioning' // F12
  | 'after_partial_module_provisioning' // F13
  | 'after_module_provisioning_completion' // F14
  | 'during_initial_limit_integration' // F15
  | 'during_u01_initialization' // F16
  | 'after_invitation_prepare' // F17
  | 'before_commercial_activation' // F18
  | 'after_commercial_activation' // F19
  | 'after_activation_snapshot_creation' // F20
  | 'during_eer_verification' // F21
  | 'after_eer_verification' // F22
  | 'before_tenant_activation' // F23
  | 'after_tenant_activation' // F24
  | 'before_invitation_dispatch' // F25
  | 'after_invitation_dispatch' // F26
  | 'before_workflow_completion' // F27
  | 'after_audit_staging' // F28
  | 'after_idempotency_completion_staging' // F29
  | 'before_transaction_commit' // F30
  | 'worker_crash_after_commit_before_ack' // F31
  | 'compensation_failure' // F32
  | 'retry_after_service_recreation'; // F33 (test orchestration)

export const PROVISIONING_FAILURE_INJECTION_ENV = 'TENANT_PROVISIONING_TEST_FAILURE_POINT';

/** Final-gate ordered catalog for executable matrix runners. */
export const PROVISIONING_FAILURE_POINTS_F01_F33: ProvisioningFailureInjectionPoint[] = [
  'after_validation',
  'after_idempotency_claim',
  'after_workflow_row_creation',
  'after_tenant_slug_reservation',
  'after_tenant_registry',
  'after_initial_tenant_settings',
  'after_facility_assignment',
  'after_specialty_assignment',
  'after_commercial_configuration',
  'after_addon_assignment',
  'after_entitlement_preview_persistence',
  'during_first_module_provisioning',
  'after_partial_module_provisioning',
  'after_module_provisioning_completion',
  'during_initial_limit_integration',
  'during_u01_initialization',
  'after_invitation_prepare',
  'before_commercial_activation',
  'after_commercial_activation',
  'after_activation_snapshot_creation',
  'during_eer_verification',
  'after_eer_verification',
  'before_tenant_activation',
  'after_tenant_activation',
  'before_invitation_dispatch',
  'after_invitation_dispatch',
  'before_workflow_completion',
  'after_audit_staging',
  'after_idempotency_completion_staging',
  'before_transaction_commit',
  'worker_crash_after_commit_before_ack',
  'compensation_failure',
  'retry_after_service_recreation',
];
