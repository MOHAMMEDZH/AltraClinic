/**
 * Phase 45b — Metrics domain model (OD-METRICS, OD-TELEMETRY).
 * OpenTelemetry-compatible types; vendor-neutral.
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export type MetricUnit =
  | '1'
  | 'ms'
  | 's'
  | 'By'
  | '{request}'
  | '{error}'
  | '{job}'
  | '{alert}';

export type MetricScope = 'platform' | 'tenant' | 'system';

export type MetricDataClass = 'ops_public' | 'ops_tenant' | 'ops_platform';

/** Approved global label keys (OD-CARDINALITY / OD-PHI). */
export const METRIC_GLOBAL_LABEL_ALLOWLIST = [
  'tenant_id',
  'service',
  'component',
  'queue',
  'method',
  'status_class',
  'hub',
  'outcome',
  'error_class',
  'dependency',
] as const;

export type MetricAllowedLabelKey =
  (typeof METRIC_GLOBAL_LABEL_ALLOWLIST)[number];

/** Explicitly forbidden label keys (fail-closed). */
export const METRIC_FORBIDDEN_LABEL_KEYS = [
  'user_id',
  'userid',
  'patient_id',
  'patientid',
  'mrn',
  'email',
  'name',
  'full_name',
  'phone',
  'url',
  'path',
  'query',
  'body',
  'message',
  'error_message',
  'sql',
  'token',
  'authorization',
  'password',
  'secret',
  'api_key',
  'apikey',
  'diagnosis',
  'medication',
  'note',
  'clinical',
] as const;

export interface MetricDescriptor {
  name: string;
  type: MetricType;
  unit: MetricUnit;
  description: string;
  /** Subset of global allowlist; empty = platform-only labels (service/component). */
  allowedLabels: readonly MetricAllowedLabelKey[];
  scope: MetricScope;
  dataClass: MetricDataClass;
  /** Max distinct label-sets for this metric (OD-CARDINALITY). */
  maxSeries: number;
  /** Retention hint days (OD-RETENTION metadata). */
  retentionDays: number;
  /** Histogram bucket boundaries (ms or unit of metric); required for histogram. */
  histogramBounds?: readonly number[];
  /** Optional observation sample ratio 0–1 (OD-SAMPLING); 1 = always. */
  sampleRatio?: number;
}

export type MetricLabels = Readonly<Partial<Record<MetricAllowedLabelKey, string>>>;

export interface MetricObservation {
  name: string;
  value: number;
  labels?: MetricLabels;
  /** Explicit tenant attribution; normalized into tenant_id label when scope allows. */
  tenantId?: string | null;
  recordedAt?: number;
}

export type MetricRecordRejectReason =
  | 'pipeline_inactive'
  | 'unknown_metric'
  | 'type_mismatch'
  | 'invalid_value'
  | 'forbidden_label'
  | 'disallowed_label'
  | 'invalid_label_value'
  | 'phi_rejected'
  | 'cardinality_exceeded'
  | 'sampled_out'
  | 'store_rejected';

export interface MetricRecordAccepted {
  ok: true;
  seriesKey: string;
}

export interface MetricRecordRejected {
  ok: false;
  reason: MetricRecordRejectReason;
  detail?: string;
}

export type MetricRecordResult = MetricRecordAccepted | MetricRecordRejected;

export interface CounterSeriesState {
  type: 'counter';
  value: number;
}

export interface GaugeSeriesState {
  type: 'gauge';
  value: number;
}

export interface HistogramSeriesState {
  type: 'histogram';
  counts: number[];
  sum: number;
  count: number;
  bounds: readonly number[];
}

export type MetricSeriesState =
  | CounterSeriesState
  | GaugeSeriesState
  | HistogramSeriesState;

export interface MetricSeriesSnapshot {
  name: string;
  type: MetricType;
  unit: MetricUnit;
  labels: Record<string, string>;
  tenantId: string | null;
  scope: MetricScope;
  dataClass: MetricDataClass;
  state: MetricSeriesState;
  updatedAt: number;
}

export interface MetricsPipelineDiagnostics {
  active: boolean;
  registeredMetrics: number;
  seriesCount: number;
  observationsAccepted: number;
  observationsRejected: number;
  rejectsByReason: Readonly<Partial<Record<MetricRecordRejectReason, number>>>;
  exportFailures: number;
  lastError?: string;
}
