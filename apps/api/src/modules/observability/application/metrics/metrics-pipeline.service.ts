import { Inject, Injectable } from '@nestjs/common';
import {
  isSystemMonitoringObservabilityEnabled,
  loadObservabilityFeatureFlags,
} from '../../config/observability-config';
import type {
  MetricDescriptor,
  MetricObservation,
  MetricRecordRejectReason,
  MetricRecordResult,
  MetricSeriesSnapshot,
  MetricsPipelineDiagnostics,
  MetricType,
} from '../../domain/metrics.types';
import { MetricRegistryService } from './metric-registry.service';
import {
  fingerprintLabels,
  validateAndNormalizeLabels,
} from './label-policy';
import {
  METRICS_STORE,
  type MetricsStorePort,
} from '../ports/storage.port';
import {
  METRICS_EXPORT,
  type MetricsExportPort,
} from '../ports/export.port';
import type { MetricsPipelineService } from '../ports/services';

/**
 * Phase 45b — metrics pipeline (OD-METRICS, OD-FAILURE, OD-OVERHEAD, OD-CARDINALITY, OD-PHI).
 * Fail-open for callers: never throws on record path.
 */
@Injectable()
export class InProcessMetricsPipelineService implements MetricsPipelineService {
  readonly contractVersion = '45b' as const;

  private observationsAccepted = 0;
  private observationsRejected = 0;
  private exportFailures = 0;
  private lastError?: string;
  private readonly rejectsByReason: Partial<
    Record<MetricRecordRejectReason, number>
  > = {};

  constructor(
    private readonly registry: MetricRegistryService,
    @Inject(METRICS_STORE) private readonly store: MetricsStorePort,
    @Inject(METRICS_EXPORT) private readonly metricsExport: MetricsExportPort,
  ) {}

  isActive(): boolean {
    const flags = loadObservabilityFeatureFlags();
    return (
      isSystemMonitoringObservabilityEnabled() &&
      flags.metricsEnabled &&
      typeof this.store.apply === 'function'
    );
  }

  listDescriptors(): readonly MetricDescriptor[] {
    return this.registry.list();
  }

  record(
    observation: MetricObservation,
    expectedType?: MetricType,
  ): MetricRecordResult {
    try {
      if (!this.isActive()) {
        return this.reject('pipeline_inactive');
      }
      if (!Number.isFinite(observation.value)) {
        return this.reject('invalid_value', 'value must be finite');
      }

      const descriptor = this.registry.get(observation.name);
      if (!descriptor) {
        return this.reject('unknown_metric', observation.name);
      }
      if (expectedType && descriptor.type !== expectedType) {
        return this.reject(
          'type_mismatch',
          `expected ${expectedType}, got ${descriptor.type}`,
        );
      }

      if (descriptor.type === 'counter' && observation.value < 0) {
        return this.reject('invalid_value', 'counter delta must be >= 0');
      }

      const sampleRatio = descriptor.sampleRatio ?? 1;
      if (sampleRatio < 1 && Math.random() >= sampleRatio) {
        return this.reject('sampled_out');
      }

      const labelsResult = validateAndNormalizeLabels(
        descriptor,
        observation.labels,
        observation.tenantId,
      );
      if (!labelsResult.ok) {
        return this.reject(labelsResult.reason, labelsResult.key);
      }

      if (!this.store.apply) {
        return this.reject('store_rejected', 'store.apply missing');
      }

      const applied = this.store.apply({
        name: descriptor.name,
        type: descriptor.type,
        unit: descriptor.unit,
        labels: labelsResult.labels,
        tenantId: labelsResult.tenantId,
        scope: descriptor.scope,
        dataClass: descriptor.dataClass,
        value: observation.value,
        histogramBounds: descriptor.histogramBounds,
        recordedAt: observation.recordedAt ?? Date.now(),
        maxSeriesForMetric: descriptor.maxSeries,
      });

      if (!applied.ok) {
        const reason =
          applied.reason === 'cardinality_exceeded'
            ? 'cardinality_exceeded'
            : 'store_rejected';
        this.bumpInternalDrop(reason);
        return this.reject(reason, applied.detail);
      }

      this.observationsAccepted += 1;
      return { ok: true, seriesKey: applied.seriesKey };
    } catch (err) {
      this.lastError = err instanceof Error ? err.message : 'record_failed';
      return this.reject('store_rejected', this.lastError);
    }
  }

  increment(
    name: string,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
    by = 1,
  ): MetricRecordResult {
    return this.record({ name, value: by, labels, tenantId }, 'counter');
  }

  setGauge(
    name: string,
    value: number,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
  ): MetricRecordResult {
    return this.record({ name, value, labels, tenantId }, 'gauge');
  }

  observeHistogram(
    name: string,
    value: number,
    labels?: MetricObservation['labels'],
    tenantId?: string | null,
  ): MetricRecordResult {
    return this.record({ name, value, labels, tenantId }, 'histogram');
  }

  query(filter?: {
    name?: string;
    tenantId?: string | null;
    sinceMs?: number;
    includeOtherTenants?: boolean;
  }): readonly MetricSeriesSnapshot[] {
    if (!this.store.listSeries) return [];
    const flags = loadObservabilityFeatureFlags();
    if (!flags.centerEnabled) return [];

    // Tenant isolation: default filter to requested tenant; cross-tenant only when flagged by caller (RBAC enforced at controller).
    if (filter?.includeOtherTenants) {
      return this.store.listSeries({
        name: filter.name,
        sinceMs: filter.sinceMs,
      });
    }
    return this.store.listSeries({
      name: filter?.name,
      tenantId: filter?.tenantId,
      sinceMs: filter?.sinceMs,
    });
  }

  exportText(): string {
    try {
      if (!this.metricsExport.renderText || !this.store.listSeries) {
        return '# metrics export unavailable\n';
      }
      if (!isSystemMonitoringObservabilityEnabled()) {
        return '# Observability Center disabled\n';
      }
      const series = this.store.listSeries();
      return this.metricsExport.renderText(series);
    } catch (err) {
      this.exportFailures += 1;
      this.lastError = err instanceof Error ? err.message : 'export_failed';
      return '# metrics export failed\n';
    }
  }

  diagnostics(): MetricsPipelineDiagnostics {
    return {
      active: this.isActive(),
      registeredMetrics: this.registry.list().length,
      seriesCount: this.store.seriesCount?.() ?? 0,
      observationsAccepted: this.observationsAccepted,
      observationsRejected: this.observationsRejected,
      rejectsByReason: { ...this.rejectsByReason },
      exportFailures: this.exportFailures,
      lastError: this.lastError,
    };
  }

  /** Test helper */
  resetDiagnosticsForTests(): void {
    this.observationsAccepted = 0;
    this.observationsRejected = 0;
    this.exportFailures = 0;
    this.lastError = undefined;
    for (const k of Object.keys(this.rejectsByReason)) {
      delete this.rejectsByReason[k as MetricRecordRejectReason];
    }
    this.store.clear?.();
  }

  private reject(
    reason: MetricRecordRejectReason,
    detail?: string,
  ): MetricRecordResult {
    this.observationsRejected += 1;
    this.rejectsByReason[reason] = (this.rejectsByReason[reason] ?? 0) + 1;
    return { ok: false, reason, detail };
  }

  private bumpInternalDrop(outcome: string): void {
    // Best-effort internal diagnostic counter — must not throw / recurse unboundedly.
    try {
      if (!this.isActive() || !this.store.apply) return;
      const descriptor = this.registry.get('observability.pipeline.rejected');
      if (!descriptor) return;
      const labels = { service: 'observability', component: 'pipeline', outcome, error_class: outcome };
      const fp = fingerprintLabels(labels);
      void fp;
      this.store.apply({
        name: descriptor.name,
        type: 'counter',
        unit: descriptor.unit,
        labels,
        tenantId: null,
        scope: descriptor.scope,
        dataClass: descriptor.dataClass,
        value: 1,
        recordedAt: Date.now(),
        maxSeriesForMetric: descriptor.maxSeries,
      });
    } catch {
      // ignore
    }
  }
}
