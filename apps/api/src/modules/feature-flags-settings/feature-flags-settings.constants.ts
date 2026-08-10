export const FEATURE_FLAGS_SETTINGS_ENABLED_ENV = 'FEATURE_FLAGS_SETTINGS_ENABLED';
/**
 * Test-only failure-injection selector.
 * Activation requires BOTH:
 *   1. `NODE_ENV === 'test'` (hard guard — production/development/missing NODE_ENV never activate)
 *   2. exact match of this env var to a known injection point
 * Never documented in `.env.example`, deployment manifests, or public API contracts.
 */
export const FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV =
  'FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION';

/** All Step 20 failure-injection point identifiers (inventory). */
export const FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_POINTS = [
  'after_authorization',
  'after_idempotency_claim',
  'after_preview_revalidation',
  'after_row_lock',
  'after_flag_mutation_staging',
  'after_target_mutation_staging',
  'after_setting_mutation_staging',
  'after_kill_switch_staging',
  'after_history_staging',
  'after_audit_staging',
  'after_idempotency_completion_staging',
  'before_commit',
  'after_commit_before_response',
  'cache_invalidation_failure',
  'eer_adapter_failure',
  'service_recreation_before_replay',
  'notification_outbox_failure',
  'environment_compatibility_adapter_failure',
  'target_resolution_failure',
  'rollback_recovery_failure',
] as const;

/**
 * Model B hard guard: injection activates only under Jest/test process (`NODE_ENV=test`).
 * Production, development, missing, or malformed NODE_ENV → never inject.
 */
export function isFeatureFlagsSettingsFailureInjectionActive(point: string): boolean {
  if (process.env.NODE_ENV !== 'test') {
    return false;
  }
  return process.env[FEATURE_FLAGS_SETTINGS_FAILURE_INJECTION_ENV] === point;
}

/** Reuses hyphenated Platform RBAC keys; kill-switch and reference.manage are Step 20 narrow adds. */
export const FEATURE_FLAG_PERMISSIONS = {
  view: 'feature-flag.view',
  manage: 'feature-flag.manage',
  killSwitch: 'feature-flag.kill-switch',
} as const;

export const GLOBAL_SETTING_PERMISSIONS = {
  view: 'settings.view',
  manage: 'settings.manage',
  referenceManage: 'settings.reference.manage',
} as const;

export const FEATURE_FLAG_OPERATIONS = {
  CREATE: 'FEATURE_FLAG_CREATE',
  UPDATE: 'FEATURE_FLAG_UPDATE',
  TARGET_UPDATE: 'FEATURE_FLAG_TARGET_UPDATE',
  KILL_SWITCH_ACTIVATE: 'FEATURE_FLAG_KILL_SWITCH_ACTIVATE',
  KILL_SWITCH_DEACTIVATE: 'FEATURE_FLAG_KILL_SWITCH_DEACTIVATE',
  DEPRECATE: 'FEATURE_FLAG_DEPRECATE',
} as const;

export const GLOBAL_SETTING_OPERATIONS = {
  CREATE: 'GLOBAL_SETTING_CREATE',
  UPDATE: 'GLOBAL_SETTING_UPDATE',
  REFERENCE_UPDATE: 'GLOBAL_SETTING_REFERENCE_UPDATE',
} as const;

export const PREVIEW_TTL_MS = 5 * 60 * 1000;
export const REASON_MAX_LEN = 2000;
export const KEY_MAX_LEN = 128;
export const FLAG_KEY_PREFIX = 'ops.';
export const SETTING_KEY_PREFIX = 'setting.';

export const SECRET_FIELD_MARKERS = [
  'password',
  'secret',
  'apikey',
  'api_key',
  'token',
  'privatekey',
  'private_key',
  'connectionstring',
  'connection_string',
  'credential',
] as const;
