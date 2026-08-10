/**
 * Phase 45a–45e — storage ports.
 */
import type { MetricSeriesSnapshot, MetricType } from '../../domain/metrics.types';
import type { StructuredLogEvent } from '../../domain/logging.types';
import type { SpanRecord } from '../../domain/tracing.types';
import type { AlertInstance, AlertState } from '../../domain/alert.types';

export const METRICS_STORE = Symbol('METRICS_STORE');
export const LOG_STORE = Symbol('LOG_STORE');
export const TRACE_STORE = Symbol('TRACE_STORE');
export const ALERT_STATE_STORE = Symbol('ALERT_STATE_STORE');

export type ObservabilityStorageProviderKind =
  | 'unconfigured'
  | 'null'
  | 'in_platform'
  | 'external';

export type ObservabilityContractVersion =
  | '45a'
  | '45b'
  | '45c'
  | '45d'
  | '45e';

export interface MetricsStoreApplyInput {
  name: string;
  type: MetricType;
  unit: string;
  labels: Record<string, string>;
  tenantId: string | null;
  scope: string;
  dataClass: string;
  value: number;
  histogramBounds?: readonly number[];
  recordedAt: number;
  maxSeriesForMetric: number;
}

export type MetricsStoreApplyResult =
  | { ok: true; seriesKey: string; seriesCountForMetric: number }
  | { ok: false; reason: 'cardinality_exceeded' | 'store_error'; detail?: string };

export interface MetricsStorePort {
  readonly contractVersion: ObservabilityContractVersion;
  readonly providerKind: ObservabilityStorageProviderKind;
  apply?(input: MetricsStoreApplyInput): MetricsStoreApplyResult;
  listSeries?(filter?: {
    name?: string;
    tenantId?: string | null;
    sinceMs?: number;
  }): readonly MetricSeriesSnapshot[];
  seriesCount?(): number;
  seriesCountForMetric?(name: string): number;
  clear?(): void;
}

export interface LogStorePort {
  readonly contractVersion: ObservabilityContractVersion;
  readonly providerKind: ObservabilityStorageProviderKind;
  append?(
    event: StructuredLogEvent,
  ): { ok: true } | { ok: false; reason: string };
  list?(filter?: {
    tenantId?: string | null;
    sinceMs?: number;
    category?: string;
    correlationId?: string;
    includeOtherTenants?: boolean;
  }): readonly StructuredLogEvent[];
  count?(): number;
  clear?(): void;
}

export interface TraceStorePort {
  readonly contractVersion: ObservabilityContractVersion;
  readonly providerKind: ObservabilityStorageProviderKind;
  append?(span: SpanRecord): { ok: true } | { ok: false; reason: string };
  list?(filter?: {
    traceId?: string;
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly SpanRecord[];
  count?(): number;
  clear?(): void;
}

export interface AlertStateStorePort {
  readonly contractVersion: ObservabilityContractVersion;
  readonly providerKind: ObservabilityStorageProviderKind;
  upsert?(alert: AlertInstance): AlertInstance;
  getById?(id: string): AlertInstance | undefined;
  getByFingerprint?(fingerprint: string): AlertInstance | undefined;
  list?(filter?: {
    tenantId?: string | null;
    state?: AlertState | AlertState[];
    includeOtherTenants?: boolean;
  }): readonly AlertInstance[];
  count?(): number;
  clear?(): void;
}
