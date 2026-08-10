/**
 * Phase 45a — Telemetry name/field registry only.
 * No runtime metrics, logging pipeline, or tracing (45b–45d).
 */
import {
  OBSERVABILITY_DATA_CLASSES,
  OBSERVABILITY_LOG_KIND,
  OBSERVABILITY_METRIC_NAMES,
  OBSERVABILITY_METRICS_NAMESPACE,
  OBSERVABILITY_STRUCTURED_LOG_FIELDS,
  OBSERVABILITY_TRACE_NAMESPACE,
} from '../observability.constants';

export class ObservabilityTelemetryContracts {
  readonly logKind = OBSERVABILITY_LOG_KIND;
  readonly metricsNamespace = OBSERVABILITY_METRICS_NAMESPACE;
  readonly traceNamespace = OBSERVABILITY_TRACE_NAMESPACE;
  readonly metricNames: readonly string[] = OBSERVABILITY_METRIC_NAMES;
  readonly structuredLogFields: readonly string[] =
    OBSERVABILITY_STRUCTURED_LOG_FIELDS;
  readonly dataClasses: readonly string[] = OBSERVABILITY_DATA_CLASSES;

  listMetricNames(): readonly string[] {
    return this.metricNames;
  }

  listStructuredLogFields(): readonly string[] {
    return this.structuredLogFields;
  }

  listDataClasses(): readonly string[] {
    return this.dataClasses;
  }

  /** Correlation ID field name reserved for later ingress (45c). */
  correlationIdField(): 'correlationId' {
    return 'correlationId';
  }
}
