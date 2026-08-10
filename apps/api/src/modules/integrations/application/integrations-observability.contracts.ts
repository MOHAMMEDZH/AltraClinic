/**
 * Phase 44a — Observability registration only.
 * No runtime metrics generation.
 */
import {
  INTEGRATIONS_LOG_KIND,
  INTEGRATIONS_METRIC_NAMES,
  INTEGRATIONS_METRICS_NAMESPACE,
  INTEGRATIONS_TRACE_NAMESPACE,
} from '../integrations.constants';

export class IntegrationsObservabilityContracts {
  readonly logKind = INTEGRATIONS_LOG_KIND;
  readonly metricsNamespace = INTEGRATIONS_METRICS_NAMESPACE;
  readonly traceNamespace = INTEGRATIONS_TRACE_NAMESPACE;
  readonly metricNames: readonly string[] = INTEGRATIONS_METRIC_NAMES;

  listMetricNames(): readonly string[] {
    return this.metricNames;
  }

  /** Correlation ID field name used by later payloads. */
  correlationIdField(): 'correlationId' {
    return 'correlationId';
  }
}
