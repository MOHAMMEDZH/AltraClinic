export const OPERATIONS_CONSOLE_ENABLED_ENV = 'OPERATIONS_CONSOLE_ENABLED';

/**
 * Test-only failure-injection selector (Model B).
 * Activation requires NODE_ENV === 'test' AND exact point match.
 * Never document in .env.example or deployment manifests.
 */
export const OPERATIONS_CONSOLE_FAILURE_INJECTION_ENV = 'OPERATIONS_CONSOLE_FAILURE_INJECTION';

export const OPERATIONS_CONSOLE_PERMISSIONS = {
  view: 'operations.view',
  execute: 'operations.execute',
  backupsView: 'operations.backups.view',
  integrationsView: 'operations.integrations.view',
  entitlementHealthView: 'operations.entitlement-health.view',
  cacheInvalidate: 'operations.cache.invalidate',
  provisionView: 'tenant.provision.view',
  provisionRetry: 'tenant.provision.retry',
} as const;

export const OPERATIONS_CONSOLE_ACTIONS = {
  PROVISIONING_RETRY: 'operations.provisioning.retry',
  WEBHOOK_RETRY: 'operations.integrations.webhook.retry',
  BACKUP_JOB_RETRY: 'operations.backups.job.retry',
  CACHE_INVALIDATE: 'operations.entitlement_cache.invalidate',
} as const;

export const OPERATIONS_CONSOLE_MAX_PAGE_SIZE = 100;
export const OPERATIONS_CONSOLE_DEFAULT_PAGE_SIZE = 25;
export const OPERATIONS_CONSOLE_MAX_DATE_RANGE_DAYS = 90;
export const OPERATIONS_CONSOLE_ADAPTER_TIMEOUT_MS = 5_000;

export const OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS = [
  'health_adapter',
  'queue_adapter',
  'backup_adapter',
  'integration_adapter',
  'entitlement_health_adapter',
  'job_lookup',
  'source_state_validation',
  'after_idempotency_claim',
  'after_retry_request_staging',
  'after_audit_staging_before_commit',
  'before_commit',
  'after_commit_before_response',
  'source_retry_service',
  'cache_invalidation',
  'provisioning_retry',
  'subscription_expiry_retry',
  'override_expiry_retry',
  'compatibility_rerun',
  'backup_request',
  'service_recreation',
  'rate_limit_adapter',
  'step_up_validation',
  'redaction',
  'rollback_recovery',
] as const;

export type OperationsConsoleFailureInjectionPoint =
  (typeof OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS)[number];

export function isOperationsConsoleFailureInjectionActive(point: string): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (
    !(OPERATIONS_CONSOLE_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)
  ) {
    return false;
  }
  return process.env[OPERATIONS_CONSOLE_FAILURE_INJECTION_ENV] === point;
}
