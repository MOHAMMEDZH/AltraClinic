/**
 * Phase 46a — Observability registration only (consume Release 45).
 * No parallel telemetry stack.
 */
import {
  PATIENT_PORTAL_LOG_KIND,
  PATIENT_PORTAL_METRIC_NAMES,
  PATIENT_PORTAL_METRICS_NAMESPACE,
  PATIENT_PORTAL_TRACE_NAMESPACE,
} from '../patient-portal.constants';

export class PatientPortalObservabilityContracts {
  readonly logKind = PATIENT_PORTAL_LOG_KIND;
  readonly metricsNamespace = PATIENT_PORTAL_METRICS_NAMESPACE;
  readonly traceNamespace = PATIENT_PORTAL_TRACE_NAMESPACE;
  readonly metricNames: readonly string[] = PATIENT_PORTAL_METRIC_NAMES;

  listMetricNames(): readonly string[] {
    return this.metricNames;
  }

  correlationIdField(): 'correlationId' {
    return 'correlationId';
  }

  /** Structured log hook — never accepts PHI fields by contract. */
  createFoundationLogFields(input: {
    correlationId?: string | null;
    tenantId?: string | null;
    event: string;
  }): Record<string, string | boolean> {
    return {
      kind: this.logKind,
      event: input.event,
      correlationId: input.correlationId ?? '',
      tenantId: input.tenantId ?? '',
      phi: false,
    };
  }
}
