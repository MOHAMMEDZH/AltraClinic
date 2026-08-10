export const AUDIT_CENTER_ENABLED_ENV = 'AUDIT_CENTER_ENABLED';

/**
 * Test-only failure-injection selector.
 * Activation requires NODE_ENV === 'test' AND exact point match (Model B).
 * Never document in .env.example or deployment manifests.
 */
export const AUDIT_CENTER_FAILURE_INJECTION_ENV = 'AUDIT_CENTER_FAILURE_INJECTION';

export const AUDIT_CENTER_PERMISSIONS = {
  view: 'audit.view',
  export: 'audit.export',
  sensitiveView: 'audit.sensitive.view',
  networkMetadataView: 'audit.network-metadata.view',
} as const;

export const AUDIT_CENTER_OPERATIONS = {
  EXPORT_REQUEST: 'AUDIT_EXPORT_REQUEST',
  EXPORT_COMPLETE: 'AUDIT_EXPORT_COMPLETE',
  EXPORT_FAIL: 'AUDIT_EXPORT_FAIL',
} as const;

export const AUDIT_CENTER_MAX_PAGE_SIZE = 100;
export const AUDIT_CENTER_DEFAULT_PAGE_SIZE = 25;
export const AUDIT_CENTER_MAX_DATE_RANGE_DAYS = 366;
export const AUDIT_CENTER_EXPORT_MAX_ROWS = 10_000;
export const AUDIT_CENTER_CORRELATION_MAX = 100;
export const AUDIT_CENTER_EXPORT_TTL_MS = 15 * 60 * 1000;

export const AUDIT_CENTER_FAILURE_INJECTION_POINTS = [
  'after_authorization',
  'after_query_parse',
  'after_source_lookup',
  'after_cursor_decode',
  'before_export_generate',
  'after_export_staging',
  'after_export_audit_staging',
  'before_commit',
  'after_commit_before_response',
  'redaction_failure',
  'immutability_update_attempt',
  'immutability_delete_attempt',
  'service_recreation_before_replay',
] as const;

export function isAuditCenterFailureInjectionActive(point: string): boolean {
  if (process.env.NODE_ENV !== 'test') {
    return false;
  }
  return process.env[AUDIT_CENTER_FAILURE_INJECTION_ENV] === point;
}
