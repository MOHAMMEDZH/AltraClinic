/**
 * Phase 45a–45d — service contracts.
 */
import type {
  MetricDescriptor,
  MetricObservation,
  MetricRecordResult,
  MetricSeriesSnapshot,
  MetricsPipelineDiagnostics,
  MetricType,
} from '../../domain/metrics.types';
import type {
  LogWriteInput,
  LogWriteResult,
  LoggingPipelineDiagnostics,
  StructuredLogEvent,
} from '../../domain/logging.types';
import type { CorrelationContext } from '../../domain/correlation.types';
import type {
  SpanRecord,
  StartSpanInput,
  TraceContext,
  TracingDiagnostics,
} from '../../domain/tracing.types';
import type { PlatformHealthReport } from '../../domain/health.types';

export const METRICS_PIPELINE = Symbol('METRICS_PIPELINE');
export const LOGGING_PIPELINE = Symbol('LOGGING_PIPELINE');
export const CORRELATION_SERVICE = Symbol('CORRELATION_SERVICE');
export const TRACING_SERVICE = Symbol('TRACING_SERVICE');
export const HEALTH_AGGREGATOR = Symbol('HEALTH_AGGREGATOR');
export const ALERT_EVALUATOR = Symbol('ALERT_EVALUATOR');
export const REDACTION_SERVICE = Symbol('REDACTION_SERVICE');

export type ContractVersion = '45a' | '45b' | '45c' | '45d' | '45e';

export interface MetricsPipelineService {
  readonly contractVersion: ContractVersion;
  isActive?(): boolean;
  record?(
    observation: MetricObservation,
    expectedType?: MetricType,
  ): MetricRecordResult;
  increment?(
    name: string,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
    by?: number,
  ): MetricRecordResult;
  setGauge?(
    name: string,
    value: number,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
  ): MetricRecordResult;
  observeHistogram?(
    name: string,
    value: number,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
  ): MetricRecordResult;
  query?(filter?: {
    name?: string;
    tenantId?: string | null;
    sinceMs?: number;
    includeOtherTenants?: boolean;
  }): readonly MetricSeriesSnapshot[];
  listDescriptors?(): readonly MetricDescriptor[];
  diagnostics?(): MetricsPipelineDiagnostics;
  exportText?(): string;
}

export interface LoggingPipelineService {
  readonly contractVersion: ContractVersion;
  isActive?(): boolean;
  write?(input: LogWriteInput): LogWriteResult;
  query?(filter?: {
    tenantId?: string | null;
    sinceMs?: number;
    category?: string;
    correlationId?: string;
    includeOtherTenants?: boolean;
  }): readonly StructuredLogEvent[];
  exportNdjson?(): string;
  diagnostics?(): LoggingPipelineDiagnostics;
}

export interface CorrelationService {
  readonly contractVersion: ContractVersion;
  isActive?(): boolean;
  generateId?(): string;
  isValidId?(value: unknown): value is string;
  getContext?(): CorrelationContext | undefined;
  getCorrelationId?(): string | undefined;
  diagnostics?(): Record<string, unknown>;
}

export interface TracingService {
  readonly contractVersion: ContractVersion;
  isActive?(): boolean;
  startSpan?(input: StartSpanInput): {
    ok: boolean;
    context?: TraceContext;
    reason?: string;
  };
  endSpan?(status?: 'unset' | 'ok' | 'error', statusMessage?: string): void;
  runWithSpan?<T>(input: StartSpanInput, fn: () => T): T;
  runWithSpanAsync?<T>(
    input: StartSpanInput,
    fn: () => Promise<T>,
  ): Promise<T>;
  getActiveContext?(): TraceContext | undefined;
  parseTraceparent?(header: unknown): TraceContext | undefined;
  formatTraceparent?(ctx: TraceContext): string;
  contextFromPropagation?(input: {
    traceparent?: unknown;
    traceId?: unknown;
    spanId?: unknown;
    correlationId?: unknown;
    tenantId?: string | null;
  }): TraceContext;
  attachTraceToPayload?<T extends Record<string, unknown>>(
    payload: T,
  ): T & { traceId: string; spanId: string; traceparent: string };
  listSpans?(filter?: {
    traceId?: string;
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly SpanRecord[];
  exportJson?(): string;
  diagnostics?(): TracingDiagnostics;
}

export interface HealthAggregatorService {
  readonly contractVersion: ContractVersion;
  live?(): Promise<PlatformHealthReport>;
  ready?(): Promise<PlatformHealthReport>;
  overall?(): Promise<PlatformHealthReport>;
  aggregate?(): Promise<PlatformHealthReport>;
}

export interface AlertEvaluatorService {
  readonly contractVersion: ContractVersion;
  isActive?(): boolean;
  listRules?(): readonly import('../../domain/alert.types').AlertRuleDefinition[];
  evaluateAll?(context?: {
    tenantId?: string | null;
  }): {
    ok: boolean;
    evaluated: number;
    firings: number;
    suppressed: number;
  };
  listAlerts?(filter?: {
    tenantId?: string | null;
    state?:
      | import('../../domain/alert.types').AlertState
      | import('../../domain/alert.types').AlertState[];
    includeOtherTenants?: boolean;
  }): readonly import('../../domain/alert.types').AlertInstance[];
  getAlert?(
    id: string,
  ): import('../../domain/alert.types').AlertInstance | undefined;
  acknowledge?(
    alertId: string,
    actorId: string,
  ): {
    ok: boolean;
    alert?: import('../../domain/alert.types').AlertInstance;
    reason?: string;
  };
  silence?(
    alertId: string,
    actorId: string,
    untilIso: string,
  ): {
    ok: boolean;
    alert?: import('../../domain/alert.types').AlertInstance;
    reason?: string;
  };
  resolve?(
    alertId: string,
    actorId?: string,
  ): {
    ok: boolean;
    alert?: import('../../domain/alert.types').AlertInstance;
    reason?: string;
  };
  listIncidents?(filter?: {
    tenantId?: string | null;
    includeOtherTenants?: boolean;
  }): readonly import('../../domain/alert.types').IncidentVisibilityRecord[];
  diagnostics?(): import('../../domain/alert.types').AlertEvaluationDiagnostics;
}

export interface RedactionService {
  readonly contractVersion: ContractVersion;
}
