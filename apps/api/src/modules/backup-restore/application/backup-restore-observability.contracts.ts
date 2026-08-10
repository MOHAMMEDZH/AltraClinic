/**
 * Phase 43a — Observability registration only.
 * No runtime metrics generation.
 */
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_METRIC_NAMES,
  BACKUP_RESTORE_METRICS_NAMESPACE,
  BACKUP_RESTORE_TRACE_NAMESPACE,
} from '../backup-restore.constants';

export class BackupRestoreObservabilityContracts {
  readonly logKind = BACKUP_RESTORE_LOG_KIND;
  readonly metricsNamespace = BACKUP_RESTORE_METRICS_NAMESPACE;
  readonly traceNamespace = BACKUP_RESTORE_TRACE_NAMESPACE;
  readonly metricNames: readonly string[] = BACKUP_RESTORE_METRIC_NAMES;

  listMetricNames(): readonly string[] {
    return this.metricNames;
  }

  /** Correlation ID field name used by later job payloads. */
  correlationIdField(): 'correlationId' {
    return 'correlationId';
  }
}
