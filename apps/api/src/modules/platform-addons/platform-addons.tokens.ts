/**
 * Release 47 Step 15 — Platform Add-ons & Commercial Overrides tokens.
 */
export const PLATFORM_ADDONS_CONFIG = Symbol('PLATFORM_ADDONS_CONFIG');
export const PLATFORM_ADDONS_AUDIT_LOG = Symbol('PLATFORM_ADDONS_AUDIT_LOG');

/** Test-only transaction failure injection. Never provided by PlatformAddonsModule. */
export const PLATFORM_ADDONS_TX_FAILURE_HOOK = Symbol('PLATFORM_ADDONS_TX_FAILURE_HOOK');

/**
 * Distinct TX failure points covering mission Parts 4 A–L.
 * Production constructors leave the hook undefined.
 */
export type AddonTxFailurePoint =
  // A. Entitlement replacement
  | 'after_entitlement_delete'
  | 'after_entitlement_partial_insert'
  // B. Limit-effect replacement
  | 'after_limit_effect_delete'
  | 'after_limit_effect_partial_insert'
  // C. Applicability replacement
  | 'after_applicability_delete'
  | 'after_applicability_partial_insert'
  // Shared parent bump / idempotency / commit
  | 'after_row_version_bump'
  | 'before_idempotency_complete'
  | 'before_transaction_commit'
  // D. Clone
  | 'after_clone_source_linkage'
  | 'after_clone_identity'
  | 'after_clone_translation_partial'
  | 'after_clone_entitlement_partial'
  | 'after_clone_limit_partial'
  | 'after_clone_applicability_partial'
  // E. Publish
  | 'after_fingerprint_before_commit'
  | 'after_publish_lifecycle_update'
  // F. Retire
  | 'after_retire_lifecycle_update'
  | 'before_retire_commit'
  // G. Override draft / effect update
  | 'after_override_effect_partial'
  | 'after_override_row_version_bump'
  // H. Submit
  | 'after_submit_lifecycle'
  | 'before_submit_commit'
  // I. Approve
  | 'after_approve_lifecycle'
  | 'before_approve_commit'
  // J. Reject
  | 'after_reject_lifecycle'
  | 'before_reject_commit'
  // K. Revoke
  | 'after_revoke_lifecycle'
  | 'before_revoke_commit'
  // L. Supersede
  | 'after_supersede_draft'
  | 'after_supersede_partial_effects'
  | 'after_supersede_successor_create'
  | 'before_supersede_commit';

export type AddonTxFailureHook = (point: AddonTxFailurePoint) => void | Promise<void>;

/** @deprecated Prefer AddonTxFailurePoint which now includes override points. */
export type OverrideTxFailurePoint =
  | 'after_override_effect_partial'
  | 'after_override_row_version_bump'
  | 'after_submit_lifecycle'
  | 'before_submit_commit'
  | 'after_approve_lifecycle'
  | 'before_approve_commit'
  | 'after_reject_lifecycle'
  | 'before_reject_commit'
  | 'after_revoke_lifecycle'
  | 'before_revoke_commit'
  | 'after_supersede_draft'
  | 'after_supersede_partial_effects'
  | 'after_supersede_successor_create'
  | 'before_supersede_commit';

export type OverrideTxFailureHook = (point: OverrideTxFailurePoint) => void | Promise<void>;

/** Stable Add-on key: addon.<snake_name> — immutable, locale-independent. */
export const ADDON_KEY_REGEX = /^addon\.[a-z][a-z0-9_]{0,62}$/;

export type AddOnLifecycle = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type AddOnVersionLifecycle = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type AddOnLimitEffectType = 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED';

export type CommercialOverrideLifecycle =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'APPROVED'
  | 'REJECTED'
  | 'REVOKED'
  | 'EXPIRED';

export type CommercialOverrideEffectKind =
  | 'ENTITLEMENT_GRANT'
  | 'ENTITLEMENT_SUPPRESS'
  | 'LIMIT_SET_ABSOLUTE'
  | 'LIMIT_INCREASE_BY'
  | 'LIMIT_SET_UNLIMITED';

export type CommercialOverrideReasonCode =
  | 'SALES_CONCESSION'
  | 'CONTRACTUAL_EXCEPTION'
  | 'SUPPORT_WAIVER'
  | 'TRIAL_EXTENSION'
  | 'OTHER';

export const COMMERCIAL_OVERRIDE_REASON_CODES: readonly CommercialOverrideReasonCode[] = [
  'SALES_CONCESSION',
  'CONTRACTUAL_EXCEPTION',
  'SUPPORT_WAIVER',
  'TRIAL_EXTENSION',
  'OTHER',
] as const;

export const ADDON_LIMIT_EFFECT_TYPES: readonly AddOnLimitEffectType[] = [
  'SET_ABSOLUTE',
  'INCREASE_BY',
  'SET_UNLIMITED',
] as const;

export const COMMERCIAL_OVERRIDE_EFFECT_KINDS: readonly CommercialOverrideEffectKind[] = [
  'ENTITLEMENT_GRANT',
  'ENTITLEMENT_SUPPRESS',
  'LIMIT_SET_ABSOLUTE',
  'LIMIT_INCREASE_BY',
  'LIMIT_SET_UNLIMITED',
] as const;

export function isValidAddOnKey(key: string): boolean {
  return ADDON_KEY_REGEX.test(key.trim());
}
