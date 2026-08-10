/**
 * Phase 45b–45d — export ports (OD-EXPORT).
 */
import type { MetricSeriesSnapshot } from '../../domain/metrics.types';
import type { StructuredLogEvent } from '../../domain/logging.types';
import type { SpanRecord } from '../../domain/tracing.types';

export const METRICS_EXPORT = Symbol('METRICS_EXPORT');
export const LOGS_EXPORT = Symbol('LOGS_EXPORT');
export const TRACES_EXPORT = Symbol('TRACES_EXPORT');

export type ObservabilityExportProviderKind =
  | 'unconfigured'
  | 'null'
  | 'scrape'
  | 'push'
  | 'in_platform';

export type ObservabilityExportContractVersion =
  | '45a'
  | '45b'
  | '45c'
  | '45d'
  | '45e';

export interface MetricsExportPort {
  readonly contractVersion: ObservabilityExportContractVersion;
  readonly providerKind: ObservabilityExportProviderKind;
  readonly reservedPath: '/metrics';
  renderText?(series: readonly MetricSeriesSnapshot[]): string;
  flush?(series: readonly MetricSeriesSnapshot[]): Promise<{ ok: boolean }>;
}

export interface LogsExportPort {
  readonly contractVersion: ObservabilityExportContractVersion;
  readonly providerKind: ObservabilityExportProviderKind;
  renderNdjson?(events: readonly StructuredLogEvent[]): string;
  flush?(events: readonly StructuredLogEvent[]): Promise<{ ok: boolean }>;
}

export interface TracesExportPort {
  readonly contractVersion: ObservabilityExportContractVersion;
  readonly providerKind: ObservabilityExportProviderKind;
  renderJson?(spans: readonly SpanRecord[]): string;
  flush?(spans: readonly SpanRecord[]): Promise<{ ok: boolean }>;
}
