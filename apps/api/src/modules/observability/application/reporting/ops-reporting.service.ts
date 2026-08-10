import { Inject, Injectable } from '@nestjs/common';
import { isSystemMonitoringObservabilityEnabled } from '../../config/observability-config';
import type { OpsReport, OpsReportKind } from '../../domain/report.types';
import {
  ALERT_EVALUATOR,
  HEALTH_AGGREGATOR,
  METRICS_PIPELINE,
  type AlertEvaluatorService,
  type HealthAggregatorService,
  type MetricsPipelineService,
} from '../ports/services';

/**
 * Phase 45e — operational reporting (OD-REPORT).
 */
@Injectable()
export class OpsReportingService {
  readonly contractVersion = '45e' as const;

  constructor(
    @Inject(METRICS_PIPELINE) private readonly metrics: MetricsPipelineService,
    @Inject(HEALTH_AGGREGATOR) private readonly health: HealthAggregatorService,
    @Inject(ALERT_EVALUATOR) private readonly alerts: AlertEvaluatorService,
  ) {}

  listKinds(): readonly OpsReportKind[] {
    return [
      'availability_summary',
      'error_budget_mvp',
      'failing_components',
      'queue_pressure',
      'alert_volume',
    ];
  }

  async generate(
    kind: OpsReportKind,
    tenantId: string | null,
    includeOtherTenants = false,
  ): Promise<OpsReport> {
    const dormant = !isSystemMonitoringObservabilityEnabled();
    const generatedAt = new Date().toISOString();
    const health = await this.health.ready?.();
    const series =
      this.metrics.query?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];
    const alerts =
      this.alerts.listAlerts?.({
        tenantId: includeOtherTenants ? undefined : tenantId,
        includeOtherTenants,
      }) ?? [];

    switch (kind) {
      case 'availability_summary':
        return report(kind, 'Availability Summary', tenantId, generatedAt, dormant, [
          {
            id: 'ready',
            title: 'Readiness',
            rows: [
              {
                live: health?.live ?? true,
                ready: health?.ready ?? false,
                status: health?.status ?? 'dormant',
              },
            ],
          },
        ]);
      case 'error_budget_mvp': {
        const errors = series.filter((s) => s.name.includes('api.errors'));
        const requests = series.filter((s) => s.name.includes('api.requests'));
        const errorSum = sumCounters(errors);
        const requestSum = sumCounters(requests);
        const ratio =
          requestSum > 0 ? Number((errorSum / requestSum).toFixed(4)) : 0;
        return report(kind, 'MVP Error Budget', tenantId, generatedAt, dormant, [
          {
            id: 'budget',
            title: 'Error ratio',
            rows: [
              {
                errors: errorSum,
                requests: requestSum,
                error_ratio: ratio,
                budget_hint: 'mvp_sli_only',
              },
            ],
          },
        ]);
      }
      case 'failing_components':
        return report(kind, 'Failing Components', tenantId, generatedAt, dormant, [
          {
            id: 'components',
            title: 'Unhealthy / degraded',
            rows: (health?.contributors ?? [])
              .filter(
                (c) => c.status === 'unhealthy' || c.status === 'degraded',
              )
              .map((c) => ({
                id: c.id,
                status: c.status,
                critical: c.critical,
                message: c.message ?? null,
              })),
          },
        ]);
      case 'queue_pressure':
        return report(kind, 'Queue Pressure', tenantId, generatedAt, dormant, [
          {
            id: 'queue',
            title: 'Queue series',
            rows: [
              {
                depth_series: series.filter((s) =>
                  s.name.includes('queue.depth'),
                ).length,
                failure_series: series.filter((s) =>
                  s.name.includes('queue.failures'),
                ).length,
              },
            ],
          },
        ]);
      case 'alert_volume':
        return report(kind, 'Alert Volume', tenantId, generatedAt, dormant, [
          {
            id: 'alerts',
            title: 'Alert counts by state',
            rows: [
              {
                total: alerts.length,
                firing: alerts.filter((a) => a.state === 'firing').length,
                acknowledged: alerts.filter((a) => a.state === 'acknowledged')
                  .length,
                silenced: alerts.filter((a) => a.state === 'silenced').length,
                resolved: alerts.filter((a) => a.state === 'resolved').length,
              },
            ],
          },
        ]);
      default:
        return report(kind, 'Unknown', tenantId, generatedAt, dormant, []);
    }
  }

  exportJson(reportDoc: OpsReport): string {
    return JSON.stringify(reportDoc);
  }
}

function sumCounters(
  series: readonly { state: { type: string; value?: number } }[],
): number {
  let sum = 0;
  for (const s of series) {
    if (
      (s.state.type === 'counter' || s.state.type === 'gauge') &&
      typeof s.state.value === 'number'
    ) {
      sum += s.state.value;
    }
  }
  return sum;
}

function report(
  kind: OpsReportKind,
  title: string,
  tenantId: string | null,
  generatedAt: string,
  dormant: boolean,
  sections: OpsReport['sections'],
): OpsReport {
  return {
    kind,
    title,
    tenantId,
    generatedAt,
    dormant,
    sections,
    schemaVersion: '45e',
  };
}
