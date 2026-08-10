export const PLATFORM_SUBSCRIPTIONS_CONFIG = Symbol('PLATFORM_SUBSCRIPTIONS_CONFIG');
export const PLATFORM_SUBSCRIPTIONS_AUDIT_LOG = Symbol('PLATFORM_SUBSCRIPTIONS_AUDIT_LOG');

/** Test-only transaction failure injection. Never provided by PlatformSubscriptionsModule. */
export const PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK = Symbol(
  'PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK',
);

export const RUNTIME_EFFECTIVE = false as const;

export type PlatformSubscriptionsConfig = {
  mutationRateLimitPerMinute: number;
  highImpactRateLimitPerMinute: number;
  readHeavyRateLimitPerMinute: number;
};

/**
 * Distinct TX failure points. Production constructors leave the hook undefined.
 * Renew uses renew-specific tokens (not supersede-named aliases).
 */
export type SubscriptionTxFailurePoint =
  // A. Create
  | 'after_create_parent_insert'
  | 'before_create_commit'
  // B. Draft update
  | 'after_update_metadata'
  | 'after_update_row_version'
  // C. Plan assignment
  | 'after_plan_assignment_write'
  | 'after_plan_row_version'
  // D. Add-on replacement
  | 'after_addon_delete'
  | 'after_addon_first_insert'
  | 'after_addon_partial_insert'
  | 'after_addon_all_insert_before_row_version'
  | 'after_addon_row_version'
  | 'after_addon_audit_staging'
  | 'before_addon_idempotency'
  | 'after_addon_success_audit'
  // E. Override replacement
  | 'after_override_delete'
  | 'after_override_first_insert'
  | 'after_override_partial_insert'
  | 'after_override_all_insert_before_row_version'
  | 'after_override_row_version'
  | 'after_override_audit_staging'
  | 'before_override_idempotency'
  // F. Date update
  | 'after_dates_update'
  | 'after_dates_row_version'
  // G. Schedule
  | 'after_schedule_readiness'
  | 'after_schedule_lifecycle'
  | 'after_schedule_metadata'
  | 'after_schedule_row_version'
  | 'after_schedule_audit_staging'
  | 'before_schedule_idempotency'
  | 'before_schedule_commit'
  // H. Activation
  | 'after_activate_readiness'
  | 'after_activate_fingerprint'
  | 'after_activate_snapshot'
  | 'after_activate_lifecycle'
  | 'after_activate_current_transfer'
  | 'before_activate_commit'
  // I. Suspend
  | 'after_suspend_auth'
  | 'after_suspend_lifecycle'
  | 'after_suspend_metadata'
  | 'after_suspend_row_version'
  | 'after_suspend_audit_staging'
  | 'before_suspend_idempotency'
  | 'before_suspend_commit'
  // J. Resume
  | 'after_resume_auth'
  | 'after_resume_lifecycle'
  | 'after_resume_metadata'
  | 'after_resume_row_version'
  | 'after_resume_audit_staging'
  | 'before_resume_idempotency'
  | 'before_resume_commit'
  // K. Cancel
  | 'after_cancel_lifecycle'
  | 'after_cancel_current_clear'
  | 'before_cancel_commit'
  // L. Supersede
  | 'after_supersede_predecessor'
  | 'after_supersede_successor_create'
  | 'after_supersede_assignment_copy'
  | 'after_supersede_current_transfer'
  | 'before_supersede_commit'
  // M. Renew-specific (must not rely only on supersede-named tokens)
  | 'after_renew_validation'
  | 'after_renew_date_validation'
  | 'after_renew_successor_create'
  | 'after_renew_effective_date'
  | 'after_renew_plan_copy'
  | 'after_renew_addon_first_copy'
  | 'after_renew_addon_partial_copy'
  | 'after_renew_override_first_copy'
  | 'after_renew_override_partial_copy'
  | 'after_renew_correlation_copy'
  | 'after_renew_provenance'
  | 'after_renew_predecessor_link'
  | 'after_renew_successor_link'
  | 'after_renew_predecessor_lifecycle'
  | 'after_renew_predecessor_current_clear'
  | 'after_renew_successor_current_set'
  | 'after_renew_predecessor_row_version'
  | 'after_renew_successor_row_version'
  | 'after_renew_audit_staging'
  | 'before_renew_idempotency'
  | 'before_renew_commit'
  // Shared
  | 'before_idempotency_complete'
  | 'before_transaction_commit';

export type SubscriptionTxFailureHook = (
  point: SubscriptionTxFailurePoint,
) => void | Promise<void>;
