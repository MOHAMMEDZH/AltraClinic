import { Controller, Get, Inject } from '@nestjs/common';
import { Public } from '../../auth/api/decorators/public.decorator';
import { loadObservabilityFoundationConfig } from '../config/observability-config';
import { ObservabilityExtensionRegistry } from '../application/observability-extension.registry';
import { EffectiveObservabilityViewService } from '../application/effective-observability-view.service';
import { ObservabilityHealthContributors } from '../application/observability-health.contributors';
import { ObservabilityTelemetryContracts } from '../application/observability-telemetry.contracts';
import { ObservabilityLicensingContracts } from '../application/observability-licensing.contracts';
import { ObservabilityLifecycleService } from '../application/observability-lifecycle.service';
import {
  ALERT_STATE_STORE,
  LOG_STORE,
  METRICS_STORE,
  TRACE_STORE,
  type AlertStateStorePort,
  type LogStorePort,
  type MetricsStorePort,
  type TraceStorePort,
} from '../application/ports/storage.port';
import {
  METRICS_EXPORT,
  LOGS_EXPORT,
  TRACES_EXPORT,
  type MetricsExportPort,
  type LogsExportPort,
  type TracesExportPort,
} from '../application/ports/export.port';
import {
  ALERT_EVALUATOR,
  CORRELATION_SERVICE,
  HEALTH_AGGREGATOR,
  LOGGING_PIPELINE,
  METRICS_PIPELINE,
  REDACTION_SERVICE,
  TRACING_SERVICE,
  type AlertEvaluatorService,
  type CorrelationService,
  type HealthAggregatorService,
  type LoggingPipelineService,
  type MetricsPipelineService,
  type RedactionService,
  type TracingService,
} from '../application/ports/services';
import {
  OBSERVABILITY_METRICS_NAMESPACE,
  OBSERVABILITY_TRACE_NAMESPACE,
} from '../observability.constants';
import {
  STATIC_OBSERVABILITY_CATALOG,
  STATIC_OBSERVABILITY_CATALOG_IS_RUNTIME_AUTHORITY,
} from '../catalog/static-observability.catalog';

/**
 * Phase 45a–45d readiness probe (no PHI).
 * Metrics + logging + tracing + health aggregation wired; alerting remains unwired.
 */
@Controller('observability')
export class ObservabilityHealthController {
  constructor(
    private readonly extensions: ObservabilityExtensionRegistry,
    private readonly effectiveView: EffectiveObservabilityViewService,
    private readonly healthContributors: ObservabilityHealthContributors,
    private readonly telemetry: ObservabilityTelemetryContracts,
    private readonly licensing: ObservabilityLicensingContracts,
    private readonly lifecycle: ObservabilityLifecycleService,
    @Inject(METRICS_STORE) private readonly metricsStore: MetricsStorePort,
    @Inject(LOG_STORE) private readonly logStore: LogStorePort,
    @Inject(TRACE_STORE) private readonly traceStore: TraceStorePort,
    @Inject(ALERT_STATE_STORE)
    private readonly alertStateStore: AlertStateStorePort,
    @Inject(METRICS_EXPORT) private readonly metricsExport: MetricsExportPort,
    @Inject(LOGS_EXPORT) private readonly logsExport: LogsExportPort,
    @Inject(TRACES_EXPORT) private readonly tracesExport: TracesExportPort,
    @Inject(METRICS_PIPELINE)
    private readonly metricsPipeline: MetricsPipelineService,
    @Inject(LOGGING_PIPELINE)
    private readonly loggingPipeline: LoggingPipelineService,
    @Inject(CORRELATION_SERVICE)
    private readonly correlation: CorrelationService,
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    @Inject(HEALTH_AGGREGATOR)
    private readonly healthAggregator: HealthAggregatorService,
    @Inject(ALERT_EVALUATOR) private readonly alertEvaluator: AlertEvaluatorService,
    @Inject(REDACTION_SERVICE) private readonly redaction: RedactionService,
  ) {}

  @Public()
  @Get('health')
  async health() {
    const config = loadObservabilityFoundationConfig();
    const view = await this.effectiveView.resolve({ hasReadPermission: true });
    const diagnostics =
      this.lifecycle.getLastDiagnostics() ??
      this.lifecycle.runStartupValidation();

    return {
      ready: true,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      flags: config.flags,
      pipelines: {
        metrics: {
          wired: this.metricsPipeline.contractVersion === '45b',
          active: this.metricsPipeline.isActive?.() === true,
          contractVersion: this.metricsPipeline.contractVersion,
          diagnostics: this.metricsPipeline.diagnostics?.() ?? null,
        },
        correlation: {
          wired: this.correlation.contractVersion === '45c',
          active: this.correlation.isActive?.() === true,
          contractVersion: this.correlation.contractVersion,
          diagnostics: this.correlation.diagnostics?.() ?? null,
        },
        logging: {
          wired: this.loggingPipeline.contractVersion === '45c',
          active: this.loggingPipeline.isActive?.() === true,
          contractVersion: this.loggingPipeline.contractVersion,
          diagnostics: this.loggingPipeline.diagnostics?.() ?? null,
        },
        tracing: {
          wired: this.tracing.contractVersion === '45d',
          active: this.tracing.isActive?.() === true,
          contractVersion: this.tracing.contractVersion,
          diagnostics: this.tracing.diagnostics?.() ?? null,
        },
        healthAggregation: {
          wired: this.healthAggregator.contractVersion === '45d' || this.healthAggregator.contractVersion === '45e',
          contractVersion: this.healthAggregator.contractVersion,
        },
        alerting: {
          wired: this.alertEvaluator.contractVersion === '45e',
          active: this.alertEvaluator.isActive?.() === true,
          contractVersion: this.alertEvaluator.contractVersion,
          diagnostics: this.alertEvaluator.diagnostics?.() ?? null,
        },
        redaction: {
          wired: this.redaction.contractVersion === '45c',
          contractVersion: this.redaction.contractVersion,
        },
      },
      storage: {
        metrics: {
          providerKind: this.metricsStore.providerKind,
          contractVersion: this.metricsStore.contractVersion,
          seriesCount: this.metricsStore.seriesCount?.() ?? 0,
        },
        logs: {
          providerKind: this.logStore.providerKind,
          contractVersion: this.logStore.contractVersion,
          eventCount: this.logStore.count?.() ?? 0,
        },
        traces: {
          providerKind: this.traceStore.providerKind,
          contractVersion: this.traceStore.contractVersion,
          spanCount: this.traceStore.count?.() ?? 0,
        },
        alertState: {
          providerKind: this.alertStateStore.providerKind,
          contractVersion: this.alertStateStore.contractVersion,
        },
      },
      export: {
        metrics: {
          providerKind: this.metricsExport.providerKind,
          reservedPath: this.metricsExport.reservedPath,
          wired:
            this.metricsExport.contractVersion === '45b' ||
            this.metricsExport.contractVersion === '45c' ||
            this.metricsExport.contractVersion === '45d',
          contractVersion: this.metricsExport.contractVersion,
        },
        logs: {
          providerKind: this.logsExport.providerKind,
          wired:
            this.logsExport.contractVersion === '45c' ||
            this.logsExport.contractVersion === '45d',
          contractVersion: this.logsExport.contractVersion,
        },
        traces: {
          providerKind: this.tracesExport.providerKind,
          wired: this.tracesExport.contractVersion === '45d',
          contractVersion: this.tracesExport.contractVersion,
        },
      },
      extensionKind: {
        name: this.extensions.getExtensionKind(),
        mode: 'local' as const,
        registered: this.extensions.isRegistered(),
        adapters: this.extensions.listAdapterRegistrations().length,
      },
      catalog: {
        staticCount: STATIC_OBSERVABILITY_CATALOG.length,
        staticIsRuntimeAuthority: STATIC_OBSERVABILITY_CATALOG_IS_RUNTIME_AUTHORITY,
        executableCount: 0,
      },
      effectiveView: {
        visible: view.visible,
        types: view.types.length,
        allowObservability: view.allowObservability,
        featureEnabled: view.featureEnabled,
      },
      licensing: {
        tenantGate: this.licensing.getTenantLicenseGate(),
        capabilities: this.licensing.listCapabilities(),
      },
      healthContributors: this.healthContributors.listDefinitions(),
      registeredContributors:
        this.healthContributors.listRegisteredContributors().length,
      telemetry: {
        logKind: this.telemetry.logKind,
        metricsNamespace: OBSERVABILITY_METRICS_NAMESPACE,
        traceNamespace: OBSERVABILITY_TRACE_NAMESPACE,
        metricNamesRegistered: this.telemetry.listMetricNames().length,
        structuredLogFieldsRegistered:
          this.telemetry.listStructuredLogFields().length,
        correlationIdField: this.telemetry.correlationIdField(),
        dataClasses: this.telemetry.listDataClasses(),
      },
      diagnostics,
      defaults: config.defaults,
      phase: '45e',
    };
  }
}
