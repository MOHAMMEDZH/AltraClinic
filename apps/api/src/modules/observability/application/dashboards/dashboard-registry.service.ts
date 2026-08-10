import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import { STATIC_DASHBOARD_CATALOG } from '../../catalog/static-dashboard.catalog';
import type {
  DashboardDescriptor,
  DashboardPanel,
  DashboardQueryInput,
  DashboardSnapshot,
} from '../../domain/dashboard.types';
import {
  HEALTH_AGGREGATOR,
  LOGGING_PIPELINE,
  METRICS_PIPELINE,
  TRACING_SERVICE,
  ALERT_EVALUATOR,
  type AlertEvaluatorService,
  type HealthAggregatorService,
  type LoggingPipelineService,
  type MetricsPipelineService,
  type TracingService,
} from '../ports/services';
import {
  ALERT_STATE_STORE,
  LOG_STORE,
  METRICS_STORE,
  TRACE_STORE,
  type AlertStateStorePort,
  type LogStorePort,
  type MetricsStorePort,
  type TraceStorePort,
} from '../ports/storage.port';

/**
 * Phase 45e — dashboard registry + data providers (OD-DASHBOARD).
 * Read-only; consumes existing pipelines only.
 */
@Injectable()
export class DashboardRegistryService {
  private readonly extras: DashboardDescriptor[] = [];

  constructor(
    @Inject(METRICS_PIPELINE) private readonly metrics: MetricsPipelineService,
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    @Inject(HEALTH_AGGREGATOR) private readonly health: HealthAggregatorService,
    @Inject(METRICS_STORE) private readonly metricsStore: MetricsStorePort,
    @Inject(LOG_STORE) private readonly logStore: LogStorePort,
    @Inject(TRACE_STORE) private readonly traceStore: TraceStorePort,
    @Inject(ALERT_STATE_STORE) private readonly alertStore: AlertStateStorePort,
    @Inject(ALERT_EVALUATOR) private readonly alerts: AlertEvaluatorService,
  ) {}

  isCenterActive(): boolean {
    return isSystemMonitoringObservabilityEnabled();
  }

  listDescriptors(options?: {
    includeTenantScoped?: boolean;
  }): readonly DashboardDescriptor[] {
    const flags = loadObservabilityFeatureFlags();
    return [...STATIC_DASHBOARD_CATALOG, ...this.extras].filter((d) => {
      if (d.scope === 'tenant' && options?.includeTenantScoped === false) {
        return false;
      }
      if (d.requiresSubFlag === 'metrics' && !flags.metricsEnabled) return true; // still listed, query returns dormant
      if (d.requiresSubFlag === 'tenantDashboard' && !flags.tenantDashboardEnabled) {
        return true;
      }
      return true;
    });
  }

  registerDescriptor(descriptor: DashboardDescriptor): void {
    this.extras.push(descriptor);
  }

  getDescriptor(id: string): DashboardDescriptor | undefined {
    return this.listDescriptors().find((d) => d.id === id);
  }

  async query(input: DashboardQueryInput): Promise<DashboardSnapshot | null> {
    const descriptor = this.getDescriptor(input.dashboardId);
    if (!descriptor) return null;

    const flags = loadObservabilityFeatureFlags();
    const dormant = !this.isCenterActive();
    const generatedAt = new Date().toISOString();
    const tenantId = input.tenantId;

    if (
      descriptor.requiresSubFlag === 'tenantDashboard' &&
      !flags.tenantDashboardEnabled
    ) {
      return {
        dashboardId: descriptor.id,
        title: descriptor.title,
        scope: descriptor.scope,
        tenantId,
        generatedAt,
        dormant: true,
        panels: [
          {
            id: 'gated',
            title: 'Tenant dashboard gated',
            kind: 'status',
            data: {
              status: 'dormant',
              reason: 'OBSERVABILITY_TENANT_DASHBOARD_ENABLED_off',
            },
          },
        ],
        deepLinks: descriptor.deepLinks,
        schemaVersion: '45e',
      };
    }

    const panels = await this.buildPanels(descriptor.id, tenantId, input.includeOtherTenants === true);
    return {
      dashboardId: descriptor.id,
      title: descriptor.title,
      scope: descriptor.scope,
      tenantId,
      generatedAt,
      dormant,
      panels,
      deepLinks: descriptor.deepLinks,
      schemaVersion: '45e',
    };
  }

  private async buildPanels(
    id: string,
    tenantId: string | null,
    includeOtherTenants: boolean,
  ): Promise<readonly DashboardPanel[]> {
    const metricsDiag = this.metrics.diagnostics?.();
    const loggingDiag = this.logging.diagnostics?.();
    const tracingDiag = this.tracing.diagnostics?.();
    const alertDiag = this.alerts.diagnostics?.();
    const health = await this.health.ready?.();

    const metricSeries =
      this.metrics.query?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];
    const logs =
      this.logging.query?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];
    const spans =
      this.tracing.listSpans?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];
    const alerts =
      this.alerts.listAlerts?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];

    switch (id) {
      case 'operational_summary':
        return [
          panel('center', 'Center', 'status', {
            feature_enabled: this.isCenterActive(),
            ready: health?.ready ?? false,
            overall_status: health?.status ?? 'dormant',
          }),
          panel('pipelines', 'Pipelines', 'stat', {
            metrics_active: metricsDiag?.active ?? false,
            logging_active: loggingDiag?.active ?? false,
            tracing_active: tracingDiag?.active ?? false,
            alerting_active: alertDiag?.active ?? false,
          }),
          panel('volume', 'Volume', 'stat', {
            metric_series: metricSeries.length,
            log_events: logs.length,
            spans: spans.length,
            open_alerts: alerts.filter((a) =>
              ['firing', 'acknowledged', 'silenced'].includes(a.state),
            ).length,
          }),
        ];
      case 'platform_health':
        return [
          panel('live_ready', 'Live / Ready', 'status', {
            live: health?.live ?? true,
            ready: health?.ready ?? false,
            status: health?.status ?? 'dormant',
            unhealthy: health?.summary.unhealthy ?? 0,
            dormant: health?.summary.dormant ?? 0,
            degraded: health?.summary.degraded ?? 0,
          }),
          panel('contributors', 'Contributors', 'list', {
            count: health?.contributors.length ?? 0,
            sample: (health?.contributors ?? [])
              .slice(0, 8)
              .map((c) => `${c.id}:${c.status}`)
              .join(','),
          }),
        ];
      case 'metrics_overview':
        return [
          panel('metrics', 'Metrics', 'stat', {
            active: metricsDiag?.active ?? false,
            series: this.metricsStore.seriesCount?.() ?? metricSeries.length,
            accepted: metricsDiag?.observationsAccepted ?? 0,
            rejected: metricsDiag?.observationsRejected ?? 0,
          }),
        ];
      case 'logging_overview':
        return [
          panel('logging', 'Logging', 'stat', {
            active: loggingDiag?.active ?? false,
            events: this.logStore.count?.() ?? logs.length,
          }),
        ];
      case 'tracing_overview':
        return [
          panel('tracing', 'Tracing', 'stat', {
            active: tracingDiag?.active ?? false,
            spans: this.traceStore.count?.() ?? spans.length,
            sampled_out: tracingDiag?.sampledOut ?? 0,
            attribute_rejects: tracingDiag?.attributeRejects ?? 0,
          }),
        ];
      case 'queue_overview':
        return [
          panel('queue', 'Queue', 'series_summary', {
            depth_series: metricSeries.filter((s) =>
              s.name.includes('queue.depth'),
            ).length,
            failure_series: metricSeries.filter((s) =>
              s.name.includes('queue.failures'),
            ).length,
          }),
        ];
      case 'background_jobs_overview':
        return [
          panel('jobs', 'Jobs', 'series_summary', {
            hub_job_failure_series: metricSeries.filter((s) =>
              s.name.includes('hub.job_failures'),
            ).length,
          }),
        ];
      case 'database_health':
        return [
          panel('database', 'Database', 'status', {
            pool_series: metricSeries.filter((s) =>
              s.name.includes('db.pool'),
            ).length,
            contributor:
              health?.contributors.find((c) => c.id === 'database')?.status ??
              'dormant',
          }),
        ];
      case 'cache_health':
        return [
          panel('cache', 'Cache', 'status', {
            hit_ratio_series: metricSeries.filter((s) =>
              s.name.includes('cache.hit'),
            ).length,
            contributor:
              health?.contributors.find((c) => c.id === 'cache')?.status ??
              'dormant',
          }),
        ];
      case 'export_storage_health':
        return [
          panel('storage', 'Storage ports', 'status', {
            metrics: this.metricsStore.providerKind,
            logs: this.logStore.providerKind,
            traces: this.traceStore.providerKind,
            alerts: this.alertStore.providerKind,
          }),
        ];
      case 'tenant_operational':
        return [
          panel('tenant', 'Tenant ops', 'stat', {
            tenant_id_present: tenantId != null,
            metric_series: metricSeries.filter(
              (s) => s.tenantId === tenantId || s.tenantId === null,
            ).length,
            log_events: logs.length,
            open_alerts: alerts.length,
          }),
        ];
      case 'platform_operational':
        return [
          panel('platform', 'Platform ops', 'stat', {
            overall_status: health?.status ?? 'dormant',
            alert_rules: this.alerts.listRules?.().length ?? 0,
            alert_instances: this.alertStore.count?.() ?? alerts.length,
            hub_deep_links: 3,
          }),
        ];
      default:
        return [
          panel('unknown', 'Unknown', 'status', {
            status: 'dormant',
            reason: 'unknown_dashboard',
          }),
        ];
    }
  }
}

function panel(
  id: string,
  title: string,
  kind: DashboardPanel['kind'],
  data: DashboardPanel['data'],
): DashboardPanel {
  return { id, title, kind, data };
}
