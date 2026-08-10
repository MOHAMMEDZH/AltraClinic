import { ObservabilityExtensionRegistry } from '../application/observability-extension.registry';
import { EffectiveObservabilityViewService } from '../application/effective-observability-view.service';
import { ObservabilityHealthContributors } from '../application/observability-health.contributors';
import { ObservabilityTelemetryContracts } from '../application/observability-telemetry.contracts';
import { ObservabilityLicensingContracts } from '../application/observability-licensing.contracts';
import { ObservabilityLifecycleService } from '../application/observability-lifecycle.service';
import { ObservabilityHealthController } from '../controllers/observability-health.controller';
import { MetricRegistryService } from '../application/metrics/metric-registry.service';
import { InProcessMetricsPipelineService } from '../application/metrics/metrics-pipeline.service';
import { InMemoryMetricsStore } from '../infrastructure/in-memory/in-memory-metrics.store';
import { InProcessMetricsExport } from '../infrastructure/in-memory/in-process-metrics.export';
import { CorrelationContextService } from '../application/logging/correlation-context.service';
import { StructuredLogRedactionService } from '../application/logging/structured-log-redaction.service';
import { StructuredLoggingPipelineService } from '../application/logging/structured-logging-pipeline.service';
import { InMemoryLogStore } from '../infrastructure/in-memory/in-memory-log.store';
import { InProcessLogsExport } from '../infrastructure/in-memory/in-process-logs.export';
import { InProcessTracingService } from '../application/tracing/in-process-tracing.service';
import { InMemoryTraceStore } from '../infrastructure/in-memory/in-memory-trace.store';
import { InProcessTracesExport } from '../infrastructure/in-memory/in-process-traces.export';
import { PlatformHealthAggregatorService } from '../application/health/platform-health-aggregator.service';
import { InMemoryAlertStateStore } from '../infrastructure/in-memory/in-memory-alert-state.store';
import { InProcessAlertEvaluatorService } from '../application/alerting/in-process-alert-evaluator.service';
import { ObservabilityActivityContracts } from '../application/observability-activity.contracts';
import { ObservabilityAuditContracts } from '../application/observability-audit.contracts';
import { ObservabilityNotificationContracts } from '../application/observability-notification.contracts';
import { ObservabilityActivityEmitter } from '../application/observability-activity.emitter';
import { ObservabilityNotificationIntentRegistrar } from '../application/observability-notification-intent.registrar';
import { ObservabilityAuditBridge } from '../application/observability-audit.bridge';
import { DashboardRegistryService } from '../application/dashboards/dashboard-registry.service';
import { OpsReportingService } from '../application/reporting/ops-reporting.service';

export function createMetricsPipelineForTests() {
  const registry = new MetricRegistryService();
  const store = new InMemoryMetricsStore();
  const exp = new InProcessMetricsExport();
  const pipeline = new InProcessMetricsPipelineService(registry, store, exp);
  return { registry, store, export: exp, pipeline };
}

export function createLoggingStackForTests() {
  const correlation = new CorrelationContextService();
  const redaction = new StructuredLogRedactionService();
  const logStore = new InMemoryLogStore();
  const logsExport = new InProcessLogsExport();
  const logging = new StructuredLoggingPipelineService(
    correlation,
    redaction,
    logStore,
    logsExport,
  );
  return { correlation, redaction, logStore, logsExport, logging };
}

export function createTracingStackForTests() {
  const correlation = new CorrelationContextService();
  const store = new InMemoryTraceStore();
  const tracesExport = new InProcessTracesExport();
  const tracing = new InProcessTracingService(
    correlation,
    store,
    tracesExport,
  );
  return { correlation, store, tracesExport, tracing };
}

export function createAlertingStackForTests() {
  const { pipeline: metrics, store: metricsStore, export: metricsExport } =
    createMetricsPipelineForTests();
  const { logging, logStore, correlation } = createLoggingStackForTests();
  const { tracing, store: traceStore } = createTracingStackForTests();
  const alertStore = new InMemoryAlertStateStore();
  const activity = new ObservabilityActivityEmitter(
    new ObservabilityActivityContracts(),
  );
  const notifications = new ObservabilityNotificationIntentRegistrar(
    new ObservabilityNotificationContracts(),
  );
  const audit = new ObservabilityAuditBridge(new ObservabilityAuditContracts());
  const alerts = new InProcessAlertEvaluatorService(
    metrics,
    alertStore,
    notifications,
    activity,
    audit,
  );
  const definitions = new ObservabilityHealthContributors();
  const health = new PlatformHealthAggregatorService(
    definitions,
    metrics,
    logging,
    tracing,
    metricsStore,
    logStore,
    traceStore,
  );
  const dashboards = new DashboardRegistryService(
    metrics,
    logging,
    tracing,
    health,
    metricsStore,
    logStore,
    traceStore,
    alertStore,
    alerts,
  );
  const reports = new OpsReportingService(metrics, health, alerts);
  return {
    metrics,
    metricsStore,
    metricsExport,
    logging,
    logStore,
    correlation,
    tracing,
    traceStore,
    alertStore,
    alerts,
    activity,
    notifications,
    audit,
    health,
    dashboards,
    reports,
  };
}

export function createHealthAggregatorForTests() {
  const stack = createAlertingStackForTests();
  return {
    aggregator: stack.health,
    definitions: new ObservabilityHealthContributors(),
    metrics: stack.metrics,
    logging: stack.logging,
    tracing: stack.tracing,
    traceStore: stack.traceStore,
  };
}

export function createFoundationHealthController() {
  const tenantPolicy = {
    getAdvancedPolicy: async () => ({
      allowObservability: false,
      allowIntegrations: false,
      allowBackupRestore: false,
      allowDataImport: true,
      allowDataExport: true,
      maintenanceMode: false,
    }),
  };
  const extensions = new ObservabilityExtensionRegistry();
  const licensing = new ObservabilityLicensingContracts();
  const stack = createAlertingStackForTests();
  const { redaction, logsExport } = createLoggingStackForTests();
  return new ObservabilityHealthController(
    extensions,
    new EffectiveObservabilityViewService(extensions, tenantPolicy as never),
    new ObservabilityHealthContributors(),
    new ObservabilityTelemetryContracts(),
    licensing,
    new ObservabilityLifecycleService(extensions, licensing),
    stack.metricsStore,
    stack.logStore,
    stack.traceStore,
    stack.alertStore,
    stack.metricsExport,
    logsExport,
    new InProcessTracesExport(),
    stack.metrics,
    stack.logging,
    stack.correlation,
    stack.tracing,
    stack.health,
    stack.alerts,
    redaction,
  );
}
