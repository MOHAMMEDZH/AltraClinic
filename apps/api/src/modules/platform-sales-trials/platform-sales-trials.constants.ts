/**
 * Flexible Step 25 — Trial Creation and Customer Conversion constants.
 * Contract: docs/TRIAL_CREATION_AND_CUSTOMER_CONVERSION.md
 */

export const SALES_TRIAL_PERMISSIONS = {
  view: 'trial.view',
  create: 'trial.create',
  update: 'trial.update',
  extend: 'trial.extend',
  extendExceptional: 'trial.extend.exceptional',
  convert: 'trial.convert',
  previewEntitlements: 'trial.preview-entitlements',
} as const;

/**
 * Manager-style permissions widen Trial visibility to every Trial.
 * Everyone else is restricted to Trials owned by their own representative profile.
 */
export const SALES_TRIAL_ALL_SCOPE_PERMISSIONS = [
  SALES_TRIAL_PERMISSIONS.convert,
  'sales-lead.assign',
] as const;

export const SALES_TRIAL_AUDIT_ACTIONS = {
  /** A01 */
  CREATED: 'sales_trial.created',
  /** A02 */
  PROVISIONED: 'sales_trial.provisioned',
  /** A03 */
  UPDATED: 'sales_trial.updated',
  /** A04 */
  EXTENDED: 'sales_trial.extended',
  /** A05 */
  EXPIRED: 'sales_trial.expired',
  /** A06 */
  CONVERTED: 'sales_trial.converted',
  /** A07 */
  CANCELLED: 'sales_trial.cancelled',
} as const;
// The entitlement comparison preview is strictly read-only and deliberately emits no
// audit write, so its protected SoR delta stays 0.

export type SalesTrialAuditAction =
  (typeof SALES_TRIAL_AUDIT_ACTIONS)[keyof typeof SALES_TRIAL_AUDIT_ACTIONS];

export const SALES_TRIAL_AUDIT_CATEGORY = 'sales_trial_management';
export const SALES_TRIAL_AUDIT_RESOURCE_TYPE = 'platform_sales_trial';

export const SALES_TRIAL_IDEMPOTENCY_RETENTION_MS = 7 * 24 * 60 * 60 * 1000;

/** Durable idempotency operation namespaces (shared `platform_sales_idempotency` store). */
export const SALES_TRIAL_OPERATIONS = {
  create: 'sales_trial.create',
  extend: 'sales_trial.extend',
  convert: 'sales_trial.convert',
  cancel: 'sales_trial.cancel',
} as const;

// ─── Duration / extension policy (frozen; no 0 = unlimited) ──────────────────

export const TRIAL_DEFAULT_DURATION_DAYS = 14;
export const TRIAL_MIN_DURATION_DAYS = 1;
export const TRIAL_MAX_INITIAL_DURATION_DAYS = 90;
export const TRIAL_MAX_SINGLE_EXTENSION_DAYS = 30;
export const TRIAL_DEFAULT_MAX_EXTENSIONS = 2;
export const TRIAL_MAX_EXTENSIONS_CEILING = 12;

export const MAX_TRIAL_SPECIALTY_KEYS = 16;
export const MAX_TRIAL_MODULE_KEYS = 32;
export const MAX_TRIAL_REASON_CHARS = 1000;

export const TRIAL_EXPIRY_BATCH_LIMIT = 50;
export const TRIAL_EXPIRY_MAX_BATCH_LIMIT = 500;

/** Test-only failure-injection selectors (Model B). NODE_ENV==='test' AND exact match only. */
export const SALES_TRIALS_FAILURE_INJECTION_ENV = 'SALES_TRIALS_FAILURE_INJECTION';

export const SALES_TRIALS_FAILURE_INJECTION_POINTS = [
  'after_idempotency_claim',
  'after_catalog_validation',
  'after_plan_version_validation',
  'after_trial_draft_insert',
  'after_tenant_provisioning',
  'after_commercial_configuration',
  'after_commercial_activation',
  'after_audit_staging_before_commit',
  'before_commit',
  'after_commit_before_response',
  'occ_conflict',
  'extension_policy_validation',
  'extension_history_write',
  'expiry_claim',
  'expiry_grant_disposition',
  'expiry_lifecycle_handoff',
  'conversion_disposition_validation',
  'conversion_commercial_update',
  'conversion_outbox_write',
  'idempotency_claim_race',
] as const;

export type SalesTrialsFailureInjectionPoint =
  (typeof SALES_TRIALS_FAILURE_INJECTION_POINTS)[number];

export function isSalesTrialsFailureInjectionActive(
  point: SalesTrialsFailureInjectionPoint | string,
): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!(SALES_TRIALS_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)) return false;
  return process.env[SALES_TRIALS_FAILURE_INJECTION_ENV] === point;
}

export const TRIAL_CONVERSION_OUTBOX_EVENT_TYPE = 'platform.sales_trial.converted';
export const TRIAL_CONVERSION_OUTBOX_AGGREGATE_TYPE = 'PlatformSalesTrial';
