import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { ObservabilityHealthController } from './controllers/observability-health.controller';
import { ObservabilityMetricsController } from './controllers/observability-metrics.controller';
import { ObservabilityLogsController } from './controllers/observability-logs.controller';
import { ObservabilityTracesController } from './controllers/observability-traces.controller';
import { ObservabilityDashboardsController } from './controllers/observability-dashboards.controller';
import { ObservabilityAlertsController } from './controllers/observability-alerts.controller';
import { ObservabilityReportsController } from './controllers/observability-reports.controller';
import { PlatformHealthController } from './controllers/platform-health.controller';
import { ObservabilityExtensionRegistry } from './application/observability-extension.registry';
import { ObservabilityActivityContracts } from './application/observability-activity.contracts';
import { ObservabilityAuditContracts } from './application/observability-audit.contracts';
import { ObservabilityNotificationContracts } from './application/observability-notification.contracts';
import { ObservabilityLicensingContracts } from './application/observability-licensing.contracts';
import { ObservabilityTelemetryContracts } from './application/observability-telemetry.contracts';
import { ObservabilityHealthContributors } from './application/observability-health.contributors';
import { EffectiveObservabilityViewService } from './application/effective-observability-view.service';
import { ObservabilityLifecycleService } from './application/observability-lifecycle.service';
import { ObservabilityActivityEmitter } from './application/observability-activity.emitter';
import { ObservabilityNotificationIntentRegistrar } from './application/observability-notification-intent.registrar';
import { ObservabilityAuditBridge } from './application/observability-audit.bridge';
import { MetricRegistryService } from './application/metrics/metric-registry.service';
import { InProcessMetricsPipelineService } from './application/metrics/metrics-pipeline.service';
import {
  ApiMetricsContributor,
  DatabaseMetricsContributor,
  HubMetricsContributor,
  QueueMetricsContributor,
} from './application/metrics/metric-contributor.contracts';
import { CorrelationContextService } from './application/logging/correlation-context.service';
import { StructuredLogRedactionService } from './application/logging/structured-log-redaction.service';
import { StructuredLoggingPipelineService } from './application/logging/structured-logging-pipeline.service';
import {
  ApiLoggingContributor,
  HubLoggingContributor,
  JobLoggingContributor,
  QueueLoggingContributor,
} from './application/logging/log-contributor.contracts';
import { InProcessTracingService } from './application/tracing/in-process-tracing.service';
import {
  ApiTracingContributor,
  AsyncTracingContributor,
  HubTracingContributor,
  JobTracingContributor,
  QueueTracingContributor,
} from './application/tracing/trace-contributor.contracts';
import { PlatformHealthAggregatorService } from './application/health/platform-health-aggregator.service';
import { InProcessAlertEvaluatorService } from './application/alerting/in-process-alert-evaluator.service';
import { DashboardRegistryService } from './application/dashboards/dashboard-registry.service';
import { OpsReportingService } from './application/reporting/ops-reporting.service';
import { CorrelationMiddleware } from './api/correlation.middleware';
import { TracingMiddleware } from './api/tracing.middleware';
import { InMemoryMetricsStore } from './infrastructure/in-memory/in-memory-metrics.store';
import { InProcessMetricsExport } from './infrastructure/in-memory/in-process-metrics.export';
import { InMemoryLogStore } from './infrastructure/in-memory/in-memory-log.store';
import { InProcessLogsExport } from './infrastructure/in-memory/in-process-logs.export';
import { InMemoryTraceStore } from './infrastructure/in-memory/in-memory-trace.store';
import { InProcessTracesExport } from './infrastructure/in-memory/in-process-traces.export';
import { InMemoryAlertStateStore } from './infrastructure/in-memory/in-memory-alert-state.store';
import {
  NullHealthContributorRegistry,
  NullObservabilityConfigRepository,
} from './infrastructure/null/null-observability.repositories';
import {
  HEALTH_CONTRIBUTOR_REGISTRY,
  OBSERVABILITY_CONFIG_REPOSITORY,
} from './application/ports/repositories';
import {
  ALERT_EVALUATOR,
  CORRELATION_SERVICE,
  HEALTH_AGGREGATOR,
  LOGGING_PIPELINE,
  METRICS_PIPELINE,
  REDACTION_SERVICE,
  TRACING_SERVICE,
} from './application/ports/services';
import {
  ALERT_STATE_STORE,
  LOG_STORE,
  METRICS_STORE,
  TRACE_STORE,
} from './application/ports/storage.port';
import {
  LOGS_EXPORT,
  METRICS_EXPORT,
  TRACES_EXPORT,
} from './application/ports/export.port';

/**
 * Phase 45a–45e — Foundation through Dashboards & Alerting.
 * Master flag default OFF. No production acceptance (45f).
 */
@Module({
  imports: [SettingsModule],
  controllers: [
    PlatformHealthController,
    ObservabilityHealthController,
    ObservabilityMetricsController,
    ObservabilityLogsController,
    ObservabilityTracesController,
    ObservabilityDashboardsController,
    ObservabilityAlertsController,
    ObservabilityReportsController,
  ],
  providers: [
    ObservabilityExtensionRegistry,
    ObservabilityActivityContracts,
    ObservabilityAuditContracts,
    ObservabilityNotificationContracts,
    ObservabilityLicensingContracts,
    ObservabilityTelemetryContracts,
    ObservabilityHealthContributors,
    EffectiveObservabilityViewService,
    ObservabilityLifecycleService,
    ObservabilityActivityEmitter,
    ObservabilityNotificationIntentRegistrar,
    ObservabilityAuditBridge,
    MetricRegistryService,
    InMemoryMetricsStore,
    InProcessMetricsExport,
    InProcessMetricsPipelineService,
    ApiMetricsContributor,
    QueueMetricsContributor,
    HubMetricsContributor,
    DatabaseMetricsContributor,
    CorrelationContextService,
    StructuredLogRedactionService,
    InMemoryLogStore,
    InProcessLogsExport,
    StructuredLoggingPipelineService,
    ApiLoggingContributor,
    QueueLoggingContributor,
    JobLoggingContributor,
    HubLoggingContributor,
    InMemoryTraceStore,
    InProcessTracesExport,
    InProcessTracingService,
    ApiTracingContributor,
    QueueTracingContributor,
    JobTracingContributor,
    HubTracingContributor,
    AsyncTracingContributor,
    PlatformHealthAggregatorService,
    InMemoryAlertStateStore,
    InProcessAlertEvaluatorService,
    DashboardRegistryService,
    OpsReportingService,
    CorrelationMiddleware,
    TracingMiddleware,
    { provide: METRICS_PIPELINE, useExisting: InProcessMetricsPipelineService },
    { provide: METRICS_STORE, useExisting: InMemoryMetricsStore },
    { provide: METRICS_EXPORT, useExisting: InProcessMetricsExport },
    { provide: LOGGING_PIPELINE, useExisting: StructuredLoggingPipelineService },
    { provide: LOG_STORE, useExisting: InMemoryLogStore },
    { provide: LOGS_EXPORT, useExisting: InProcessLogsExport },
    { provide: CORRELATION_SERVICE, useExisting: CorrelationContextService },
    { provide: REDACTION_SERVICE, useExisting: StructuredLogRedactionService },
    { provide: TRACING_SERVICE, useExisting: InProcessTracingService },
    { provide: TRACE_STORE, useExisting: InMemoryTraceStore },
    { provide: TRACES_EXPORT, useExisting: InProcessTracesExport },
    { provide: HEALTH_AGGREGATOR, useExisting: PlatformHealthAggregatorService },
    { provide: ALERT_EVALUATOR, useExisting: InProcessAlertEvaluatorService },
    { provide: ALERT_STATE_STORE, useExisting: InMemoryAlertStateStore },
    {
      provide: OBSERVABILITY_CONFIG_REPOSITORY,
      useClass: NullObservabilityConfigRepository,
    },
    {
      provide: HEALTH_CONTRIBUTOR_REGISTRY,
      useClass: NullHealthContributorRegistry,
    },
  ],
  exports: [
    ObservabilityExtensionRegistry,
    EffectiveObservabilityViewService,
    ObservabilityLicensingContracts,
    ObservabilityHealthContributors,
    ObservabilityTelemetryContracts,
    ObservabilityActivityEmitter,
    ObservabilityNotificationIntentRegistrar,
    ObservabilityAuditBridge,
    MetricRegistryService,
    InProcessMetricsPipelineService,
    CorrelationContextService,
    StructuredLoggingPipelineService,
    InProcessTracingService,
    PlatformHealthAggregatorService,
    InProcessAlertEvaluatorService,
    DashboardRegistryService,
    OpsReportingService,
    METRICS_STORE,
    LOG_STORE,
    TRACE_STORE,
    ALERT_STATE_STORE,
    METRICS_EXPORT,
    LOGS_EXPORT,
    TRACES_EXPORT,
    METRICS_PIPELINE,
    LOGGING_PIPELINE,
    CORRELATION_SERVICE,
    TRACING_SERVICE,
    HEALTH_AGGREGATOR,
    ALERT_EVALUATOR,
    REDACTION_SERVICE,
  ],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationMiddleware, TracingMiddleware)
      .forRoutes('*');
  }
}
