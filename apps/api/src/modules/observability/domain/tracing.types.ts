/**
 * Phase 45d — OpenTelemetry-compatible tracing model (OD-TRACING).
 * Vendor-neutral; no exclusive APM SoR.
 */

export type SpanKind = 'internal' | 'server' | 'client' | 'producer' | 'consumer';

export type SpanStatusCode = 'unset' | 'ok' | 'error';

export interface TraceContext {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  traceFlags: number;
  correlationId?: string;
  tenantId?: string | null;
  sampled: boolean;
}

export interface SpanRecord {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: SpanKind;
  startTimeUnixMs: number;
  endTimeUnixMs?: number;
  status: SpanStatusCode;
  statusMessage?: string;
  correlationId?: string;
  tenantId?: string | null;
  service: string;
  component: string;
  attributes: Record<string, string | number | boolean | null>;
  sampled: boolean;
  schemaVersion: '45d';
}

export interface StartSpanInput {
  name: string;
  kind?: SpanKind;
  parent?: TraceContext;
  tenantId?: string | null;
  correlationId?: string;
  service?: string;
  component?: string;
  attributes?: Record<string, unknown>;
}

export type SpanAttributeAllowKey =
  | 'method'
  | 'status_class'
  | 'queue'
  | 'hub'
  | 'outcome'
  | 'error_class'
  | 'job_name'
  | 'dependency'
  | 'http_route_template'
  | 'operation';

export const SPAN_ATTRIBUTE_ALLOWLIST: readonly SpanAttributeAllowKey[] = [
  'method',
  'status_class',
  'queue',
  'hub',
  'outcome',
  'error_class',
  'job_name',
  'dependency',
  'http_route_template',
  'operation',
];

export const SPAN_FORBIDDEN_ATTRIBUTE_KEYS = [
  'patient_id',
  'mrn',
  'email',
  'body',
  'authorization',
  'cookie',
  'password',
  'secret',
  'token',
  'api_key',
  'sql',
  'url',
  'headers',
  'diagnosis',
  'medication',
  'note',
] as const;

export interface TracingDiagnostics {
  active: boolean;
  spansStarted: number;
  spansEnded: number;
  spansDropped: number;
  sampledOut: number;
  attributeRejects: number;
  exportFailures: number;
  bufferedSpans: number;
  lastError?: string;
}

/** W3C traceparent: version-traceid-spanid-flags */
export const TRACEPARENT_HEADER = 'traceparent';
export const TRACESTATE_HEADER = 'tracestate';

export const TRACE_ID_PATTERN = /^[0-9a-f]{32}$/i;
export const SPAN_ID_PATTERN = /^[0-9a-f]{16}$/i;
