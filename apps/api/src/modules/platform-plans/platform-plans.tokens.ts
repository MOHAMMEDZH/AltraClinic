/**
 * Release 47 Step 13 — Platform Plans tokens and key contract.
 */
export const PLATFORM_PLANS_CONFIG = Symbol('PLATFORM_PLANS_CONFIG');
export const PLATFORM_PLANS_AUDIT_LOG = Symbol('PLATFORM_PLANS_AUDIT_LOG');

/**
 * Test-only transaction failure injection. Never provided by PlatformPlansModule.
 * Production constructors leave this undefined.
 */
export const PLATFORM_PLANS_TX_FAILURE_HOOK = Symbol('PLATFORM_PLANS_TX_FAILURE_HOOK');

export type PlanTxFailurePoint =
  | 'after_entitlement_delete'
  | 'after_entitlement_partial_insert'
  | 'after_limit_delete'
  | 'after_limit_partial_insert'
  | 'after_row_version_bump'
  | 'after_clone_source_linkage'
  | 'after_clone_entitlement_partial'
  | 'after_clone_limit_partial'
  | 'after_fingerprint_before_commit'
  | 'before_idempotency_complete'
  | 'before_transaction_commit';

export type PlanTxFailureHook = (point: PlanTxFailurePoint) => void | Promise<void>;

/** Stable Plan key: plan.<snake_name> — immutable, locale-independent. */
export const PLAN_KEY_REGEX = /^plan\.[a-z][a-z0-9_]{0,62}$/;

export type PlanLifecycle = 'DRAFT' | 'ACTIVE' | 'ARCHIVED';
export type PlanVersionLifecycle = 'DRAFT' | 'PUBLISHED' | 'RETIRED';
export type PlanAliasLifecycle = 'ACTIVE' | 'RETIRED';

export const PLAN_ALIAS_NAMESPACES = [
  'prisma_plan_enum',
  'platform_subscription_plan',
  'clinic_ui_plan',
  'legacy_license_plan',
  'api_plan_code',
] as const;

export type PlanAliasNamespace = (typeof PLAN_ALIAS_NAMESPACES)[number];

export function isValidPlanKey(key: string): boolean {
  return PLAN_KEY_REGEX.test(key.trim());
}

/** Keys that match syntax but must never be created (unresolved commercial identifiers). */
export const FORBIDDEN_PLAN_KEYS = new Set<string>(['plan.business']);

export function isForbiddenPlanKey(key: string): boolean {
  return FORBIDDEN_PLAN_KEYS.has(key.trim().toLowerCase());
}

export function normalizeAliasValue(value: string): string {
  return value.trim().toLowerCase();
}
