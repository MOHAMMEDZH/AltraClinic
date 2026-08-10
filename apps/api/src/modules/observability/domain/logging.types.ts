/**
 * Phase 45c — Structured logging domain (OD-LOGGING).
 */

export type LogSeverity = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export type LogCategory =
  | 'api'
  | 'queue'
  | 'job'
  | 'hub'
  | 'security'
  | 'ops'
  | 'system'
  | 'audit_bridge';

export type LogScope = 'platform' | 'tenant' | 'system';

export type LogDataClass = 'ops_public' | 'ops_tenant' | 'ops_platform';

/** Stable structured log schema fields (OD-LOGGING). */
export interface StructuredLogEvent {
  timestamp: string;
  severity: LogSeverity;
  category: LogCategory;
  event: string;
  correlationId: string;
  causationId?: string;
  tenantId: string | null;
  branchId?: string | null;
  module: string;
  operation: string;
  source: string;
  version: string;
  environment: string;
  host: string;
  processId: number;
  service: string;
  component: string;
  scope: LogScope;
  dataClass: LogDataClass;
  message: string;
  /** Allowlisted attributes only after redaction. */
  attributes: Record<string, string | number | boolean | null>;
  /** Safe exception summary (no PHI). */
  error?: {
    name: string;
    code?: string;
    /** Redacted message */
    message: string;
    /** Optional truncated stack — never includes request bodies */
    stackPreview?: string;
  };
  featureFlagEnabled: boolean;
  schemaVersion: '45c';
}

export interface LogWriteInput {
  severity: LogSeverity;
  category: LogCategory;
  event: string;
  message: string;
  module: string;
  operation: string;
  source?: string;
  component?: string;
  service?: string;
  scope?: LogScope;
  dataClass?: LogDataClass;
  tenantId?: string | null;
  branchId?: string | null;
  correlationId?: string;
  causationId?: string;
  attributes?: Record<string, unknown>;
  error?: unknown;
}

export type LogWriteRejectReason =
  | 'pipeline_inactive'
  | 'invalid_schema'
  | 'phi_rejected'
  | 'forbidden_field'
  | 'store_rejected';

export type LogWriteResult =
  | { ok: true; event: StructuredLogEvent }
  | { ok: false; reason: LogWriteRejectReason; detail?: string };

export interface LoggingPipelineDiagnostics {
  active: boolean;
  eventsAccepted: number;
  eventsRejected: number;
  rejectsByReason: Readonly<Partial<Record<LogWriteRejectReason, number>>>;
  exportFailures: number;
  bufferedEvents: number;
  lastError?: string;
}

export const LOG_ATTRIBUTE_ALLOWLIST = [
  'method',
  'status_class',
  'status_code',
  'queue',
  'hub',
  'outcome',
  'error_class',
  'job_name',
  'duration_ms',
  'attempt',
  'path_template',
  'dependency',
  'flag_name',
  'license_gate',
] as const;

export type LogAllowedAttributeKey = (typeof LOG_ATTRIBUTE_ALLOWLIST)[number];

export const LOG_FORBIDDEN_ATTRIBUTE_KEYS = [
  'patient_id',
  'patientid',
  'mrn',
  'email',
  'name',
  'full_name',
  'phone',
  'body',
  'request_body',
  'response_body',
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'api_key',
  'apikey',
  'diagnosis',
  'medication',
  'note',
  'clinical',
  'sql',
  'query',
  'url',
  'headers',
  'connection_string',
  'private_key',
] as const;
