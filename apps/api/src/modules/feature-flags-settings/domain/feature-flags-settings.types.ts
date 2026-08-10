export type FeatureFlagEffect =
  | 'KILL_SWITCH_DENY'
  | 'ROLLOUT_ALLOW_FOR_ENTITLED'
  | 'INTERNAL_IMPLEMENTATION_SELECTION'
  | 'OPERATIONAL_ENABLEMENT';

export type FeatureFlagTargetType =
  | 'GLOBAL'
  | 'TENANT_ALLOWLIST'
  | 'TENANT_DENYLIST'
  | 'PERCENTAGE';

export type OperationalExplanationCode =
  | 'lifecycle_denied'
  | 'entitlement_denied'
  | 'kill_switch_denied'
  | 'rollout_excluded'
  | 'operational_allow'
  | 'flag_not_applicable';

export interface OperationalDecisionInput {
  tenantId: string;
  flagKey: string;
  /** Authoritative EER / commercial result for the capability under the flag. */
  entitlementAllows: boolean;
  /** Step 19 / auth lifecycle or security denial. */
  lifecycleDenied: boolean;
}

export interface OperationalDecisionResult {
  allowed: boolean;
  explanationCode: OperationalExplanationCode;
  flagKey: string | null;
  flagRowVersion: number | null;
  entitlementAllows: boolean;
  lifecycleDenied: boolean;
  killSwitchActive: boolean;
  rolloutIncluded: boolean;
}

export interface FeatureFlagCreateInput {
  canonicalKey: string;
  displayName: string;
  description: string;
  ownerTeam: string;
  category: string;
  effect: FeatureFlagEffect;
  targetType?: FeatureFlagTargetType;
  rolloutPercentage?: number;
  reason: string;
}

export interface FeatureFlagUpdateInput {
  displayName?: string;
  description?: string;
  ownerTeam?: string;
  category?: string;
  targetType?: FeatureFlagTargetType;
  rolloutPercentage?: number;
  status?: 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';
  reason: string;
  expectedRowVersion: number;
}

export interface FeatureFlagTargetUpdateInput {
  allowTenantIds?: string[];
  denyTenantIds?: string[];
  reason: string;
  expectedRowVersion: number;
}

export interface KillSwitchInput {
  reason: string;
  expectedRowVersion: number;
  previewFingerprint: string;
  confirmation: string;
}

export interface GlobalSettingUpdateInput {
  safeValueJson?: unknown;
  reason: string;
  expectedRowVersion: number;
  previewFingerprint?: string;
}

export interface GlobalSettingReferenceUpdateInput {
  referenceConfigured: boolean;
  referenceProviderType?: string | null;
  referenceId?: string | null;
  referenceHealthCategory?: string | null;
  referenceRotationRequired?: boolean;
  reason: string;
  expectedRowVersion: number;
  previewFingerprint?: string;
}

export type FeatureFlagsSettingsFailureInjectionPoint =
  | 'after_authorization'
  | 'after_idempotency_claim'
  | 'after_preview_revalidation'
  | 'after_row_lock'
  | 'after_flag_mutation_staging'
  | 'after_target_mutation_staging'
  | 'after_setting_mutation_staging'
  | 'after_kill_switch_staging'
  | 'after_history_staging'
  | 'after_audit_staging'
  | 'after_idempotency_completion_staging'
  | 'before_commit'
  | 'after_commit_before_response'
  | 'cache_invalidation_failure'
  | 'eer_adapter_failure'
  | 'service_recreation_before_replay'
  | 'notification_outbox_failure'
  | 'environment_compatibility_adapter_failure'
  | 'target_resolution_failure'
  | 'rollback_recovery_failure';

export class FeatureFlagsSettingsError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly httpStatus = 400,
  ) {
    super(message);
    this.name = 'FeatureFlagsSettingsError';
  }
}
