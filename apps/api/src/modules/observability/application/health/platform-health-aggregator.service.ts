import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
  loadObservabilityFoundationConfig,
} from '../../config/observability-config';
import {
  SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
} from '../../observability.constants';
import type {
  HealthContributorResult,
  HealthProbe,
  HealthStatus,
  PlatformHealthReport,
} from '../../domain/health.types';
import { ObservabilityHealthContributors } from '../observability-health.contributors';
import {
  LOGGING_PIPELINE,
  METRICS_PIPELINE,
  TRACING_SERVICE,
  type LoggingPipelineService,
  type MetricsPipelineService,
  type TracingService,
  type HealthAggregatorService,
} from '../ports/services';
import {
  LOG_STORE,
  METRICS_STORE,
  TRACE_STORE,
  type LogStorePort,
  type MetricsStorePort,
  type TraceStorePort,
} from '../ports/storage.port';

const CONTRIBUTOR_TIMEOUT_MS = 500;

/**
 * Phase 45d — health contributor execution + aggregation (OD-HEALTH).
 * Dormant ≠ unhealthy. Contributor failures are isolated.
 */
@Injectable()
export class PlatformHealthAggregatorService implements HealthAggregatorService {
  readonly contractVersion = '45d' as const;

  private readonly extraProbes: HealthProbe[] = [];

  constructor(
    private readonly definitions: ObservabilityHealthContributors,
    @Inject(METRICS_PIPELINE) private readonly metrics: MetricsPipelineService,
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    @Inject(METRICS_STORE) private readonly metricsStore: MetricsStorePort,
    @Inject(LOG_STORE) private readonly logStore: LogStorePort,
    @Inject(TRACE_STORE) private readonly traceStore: TraceStorePort,
  ) {}

  registerProbe(probe: HealthProbe): void {
    this.extraProbes.push(probe);
  }

  async live(): Promise<PlatformHealthReport> {
    const checkedAt = new Date().toISOString();
    const config = loadObservabilityFoundationConfig();
    return {
      status: 'healthy',
      live: true,
      ready: true,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: config.featureFlagEnv,
        enabled: config.featureEnabled,
      },
      contributors: [
        {
          id: 'process',
          status: 'healthy',
          critical: true,
          description: 'Node process liveness',
          message: 'up',
          checkedAt,
        },
      ],
      summary: { healthy: 1, degraded: 0, dormant: 0, unhealthy: 0 },
      phase: '45d',
      checkedAt,
    };
  }

  async ready(): Promise<PlatformHealthReport> {
    return this.aggregate();
  }

  async overall(): Promise<PlatformHealthReport> {
    // OD-HEALTH: root /health aliases ready semantics.
    return this.aggregate();
  }

  async aggregate(): Promise<PlatformHealthReport> {
    const checkedAt = new Date().toISOString();
    const config = loadObservabilityFoundationConfig();
    const probes = [...this.buildBuiltinProbes(), ...this.extraProbes];
    const contributors: HealthContributorResult[] = [];

    for (const probe of probes) {
      const result = await this.runProbe(probe, checkedAt);
      contributors.push(result);
    }

    // Keep definition registry in sync for diagnostics.
    for (const def of this.definitions.listDefinitions()) {
      if (!contributors.some((c) => c.id === def.id)) {
        contributors.push({
          id: def.id,
          status: def.status === 'not_configured' ? 'dormant' : def.status,
          critical: false,
          description: def.description,
          checkedAt,
        });
      }
    }

    const summary = {
      healthy: contributors.filter((c) => c.status === 'healthy').length,
      degraded: contributors.filter((c) => c.status === 'degraded').length,
      dormant: contributors.filter((c) => c.status === 'dormant').length,
      unhealthy: contributors.filter((c) => c.status === 'unhealthy').length,
    };

    const criticalUnhealthy = contributors.some(
      (c) => c.critical && c.status === 'unhealthy',
    );
    let status: HealthStatus = 'healthy';
    if (criticalUnhealthy) {
      status = 'unhealthy';
    } else if (!config.featureEnabled) {
      // Master flag OFF → overall dormant (dormant ≠ unhealthy; ready stays true).
      status = 'dormant';
    } else if (summary.degraded > 0) {
      status = 'degraded';
    } else if (summary.healthy === 0 && summary.dormant > 0) {
      status = 'dormant';
    }

    return {
      status,
      live: true,
      ready: !criticalUnhealthy,
      dormant: !config.featureEnabled,
      featureFlag: {
        name: SYSTEM_MONITORING_OBSERVABILITY_ENABLED_ENV,
        enabled: config.featureEnabled,
      },
      contributors,
      summary,
      phase: '45d',
      checkedAt,
    };
  }

  private buildBuiltinProbes(): HealthProbe[] {
    const flags = loadObservabilityFeatureFlags();
    const centerOn = isSystemMonitoringObservabilityEnabled();

    return [
      {
        id: 'observability_center',
        critical: false,
        description: 'Observability Center',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: centerOn ? 'center_enabled' : 'center_flag_off',
        }),
      },
      {
        id: 'feature_flags',
        critical: false,
        description: 'Observability feature flag state',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: centerOn ? 'enabled' : 'master_flag_off',
        }),
      },
      {
        id: 'configuration',
        critical: true,
        description: 'Foundation configuration load',
        check: () => {
          const cfg = loadObservabilityFoundationConfig();
          return {
            status: cfg.extensionKind === 'observability' ? 'healthy' : 'unhealthy',
            message: cfg.extensionKind,
          };
        },
      },
      {
        id: 'licensing',
        critical: false,
        description: 'Licensing gate registration',
        check: () => ({
          status: 'healthy',
          message: 'allowObservability_registered',
        }),
      },
      {
        id: 'metrics_pipeline',
        critical: false,
        description: 'Metrics pipeline',
        check: () => ({
          status: !centerOn
            ? 'dormant'
            : flags.metricsEnabled && this.metrics.isActive?.()
              ? 'healthy'
              : flags.metricsEnabled
                ? 'degraded'
                : 'dormant',
          message: `contract=${this.metrics.contractVersion}`,
        }),
      },
      {
        id: 'logging_pipeline',
        critical: false,
        description: 'Logging pipeline',
        check: () => ({
          status: !centerOn
            ? 'dormant'
            : flags.loggingEnabled && this.logging.isActive?.()
              ? 'healthy'
              : flags.loggingEnabled
                ? 'degraded'
                : 'dormant',
          message: `contract=${this.logging.contractVersion}`,
        }),
      },
      {
        id: 'tracing',
        critical: false,
        description: 'Tracing pipeline',
        check: () => ({
          status: !centerOn
            ? 'dormant'
            : flags.tracingEnabled && this.tracing.isActive?.()
              ? 'healthy'
              : flags.tracingEnabled
                ? 'degraded'
                : 'dormant',
          message: `contract=${this.tracing.contractVersion}`,
        }),
      },
      {
        id: 'correlation',
        critical: false,
        description: 'Correlation infrastructure',
        check: () => ({
          status: !centerOn
            ? 'dormant'
            : flags.loggingEnabled
              ? 'healthy'
              : 'dormant',
          message: 'als_correlation',
        }),
      },
      {
        id: 'storage_port',
        critical: false,
        description: 'Telemetry storage ports',
        check: () => {
          const kinds = [
            this.metricsStore.providerKind,
            this.logStore.providerKind,
            this.traceStore.providerKind,
          ];
          const ok = kinds.every(
            (k) => k === 'in_platform' || k === 'null' || k === 'unconfigured',
          );
          return {
            status: !centerOn ? 'dormant' : ok ? 'healthy' : 'unhealthy',
            message: kinds.join(','),
          };
        },
      },
      {
        id: 'export_port',
        critical: false,
        description: 'Telemetry export ports',
        check: () => ({
          status: !centerOn ? 'dormant' : 'healthy',
          message: 'ports_registered',
        }),
      },
      {
        id: 'contributor_registry',
        critical: false,
        description: 'Health contributor registry',
        check: () => ({
          status: 'healthy',
          message: `dynamic=${this.definitions.listRegisteredContributors().length}`,
        }),
      },
      this.hubProbe('hub_import_export', 'IMPORT_EXPORT_CENTER_ENABLED'),
      this.hubProbe('hub_backup_restore', 'BACKUP_RESTORE_CENTER_ENABLED'),
      this.hubProbe(
        'hub_integrations',
        'API_KEYS_INTEGRATIONS_CENTER_ENABLED',
      ),
      {
        id: 'hub_notification',
        critical: false,
        description: 'Notification hub contributor',
        check: () => ({
          status: 'healthy',
          message: 'notification_center_present',
        }),
      },
      {
        id: 'queue',
        critical: false,
        description: 'Queue observability surface',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: 'queue_metrics_contracts',
        }),
      },
      {
        id: 'background_jobs',
        critical: false,
        description: 'Background job observability surface',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: 'job_trace_contracts',
        }),
      },
      {
        id: 'database',
        critical: false,
        description: 'Database dependency health surface',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: 'db_metric_contracts',
        }),
      },
      {
        id: 'cache',
        critical: false,
        description: 'Cache observability surface',
        check: () => ({
          status: centerOn ? 'healthy' : 'dormant',
          message: 'cache_metric_contracts',
        }),
      },
      {
        id: 'alerting',
        critical: false,
        description: 'Alert evaluation engine',
        check: () => ({
          status: !centerOn
            ? 'dormant'
            : flags.alertingEnabled
              ? 'healthy'
              : 'dormant',
          message: `alerting_flag=${flags.alertingEnabled}`,
        }),
      },
      {
        id: 'health_aggregation',
        critical: false,
        description: 'Platform health aggregation',
        check: () => ({
          status: 'healthy',
          message: 'aggregator_45d',
        }),
      },
    ];
  }

  private hubProbe(id: string, envKey: string): HealthProbe {
    return {
      id,
      critical: false,
      description: `Hub contributor ${id}`,
      check: () => {
        const enabled = envFlagTrue(process.env, envKey);
        return {
          status: enabled ? 'healthy' : 'dormant',
          message: enabled ? 'hub_flag_on' : 'hub_flag_off',
        };
      },
    };
  }

  private async runProbe(
    probe: HealthProbe,
    checkedAt: string,
  ): Promise<HealthContributorResult> {
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const partial = await Promise.race([
        Promise.resolve(probe.check()),
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('contributor_timeout')),
            CONTRIBUTOR_TIMEOUT_MS,
          );
          timer.unref?.();
        }),
      ]);
      return {
        id: probe.id,
        critical: probe.critical,
        description: probe.description,
        status: partial.status,
        message: partial.message,
        latencyMs: Date.now() - started,
        checkedAt,
      };
    } catch (err) {
      return {
        id: probe.id,
        critical: probe.critical,
        description: probe.description,
        status: 'unhealthy',
        message: err instanceof Error ? err.message : 'probe_failed',
        latencyMs: Date.now() - started,
        checkedAt,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function envFlagTrue(env: NodeJS.ProcessEnv, key: string): boolean {
  const raw = (env[key] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}
