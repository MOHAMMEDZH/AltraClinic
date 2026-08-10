import { Injectable } from '@nestjs/common';
import type {
  CounterSeriesState,
  GaugeSeriesState,
  HistogramSeriesState,
  MetricSeriesSnapshot,
  MetricType,
} from '../../domain/metrics.types';
import type {
  MetricsStoreApplyInput,
  MetricsStoreApplyResult,
  MetricsStorePort,
} from '../../application/ports/storage.port';
import { fingerprintLabels } from '../../application/metrics/label-policy';

interface InternalSeries {
  snapshot: MetricSeriesSnapshot;
}

/**
 * Phase 45b — in-platform metrics store (OD-STORAGE).
 * Bounded by per-metric maxSeries; no external vendor.
 */
@Injectable()
export class InMemoryMetricsStore implements MetricsStorePort {
  readonly contractVersion = '45b' as const;
  readonly providerKind = 'in_platform' as const;

  private readonly series = new Map<string, InternalSeries>();

  apply(input: MetricsStoreApplyInput): MetricsStoreApplyResult {
    try {
      const seriesKey = `${input.name}|${fingerprintLabels(input.labels)}`;
      const existing = this.series.get(seriesKey);
      if (!existing) {
        const countForMetric = this.seriesCountForMetric(input.name);
        if (countForMetric >= input.maxSeriesForMetric) {
          return { ok: false, reason: 'cardinality_exceeded' };
        }
        const state = this.createState(input);
        this.series.set(seriesKey, {
          snapshot: {
            name: input.name,
            type: input.type,
            unit: input.unit as MetricSeriesSnapshot['unit'],
            labels: { ...input.labels },
            tenantId: input.tenantId,
            scope: input.scope as MetricSeriesSnapshot['scope'],
            dataClass: input.dataClass as MetricSeriesSnapshot['dataClass'],
            state,
            updatedAt: input.recordedAt,
          },
        });
        return {
          ok: true,
          seriesKey,
          seriesCountForMetric: countForMetric + 1,
        };
      }

      this.updateState(existing.snapshot.state, input);
      existing.snapshot.updatedAt = input.recordedAt;
      return {
        ok: true,
        seriesKey,
        seriesCountForMetric: this.seriesCountForMetric(input.name),
      };
    } catch (err) {
      return {
        ok: false,
        reason: 'store_error',
        detail: err instanceof Error ? err.message : 'unknown',
      };
    }
  }

  listSeries(filter?: {
    name?: string;
    tenantId?: string | null;
    sinceMs?: number;
  }): readonly MetricSeriesSnapshot[] {
    const now = Date.now();
    const out: MetricSeriesSnapshot[] = [];
    for (const { snapshot } of this.series.values()) {
      if (filter?.name && snapshot.name !== filter.name) continue;
      if (filter?.tenantId !== undefined) {
        if (filter.tenantId === null) {
          if (snapshot.tenantId !== null) continue;
        } else if (snapshot.tenantId !== filter.tenantId) {
          continue;
        }
      }
      if (filter?.sinceMs != null && snapshot.updatedAt < now - filter.sinceMs) {
        continue;
      }
      out.push({
        ...snapshot,
        labels: { ...snapshot.labels },
        state: this.cloneState(snapshot.state),
      });
    }
    return out;
  }

  seriesCount(): number {
    return this.series.size;
  }

  seriesCountForMetric(name: string): number {
    let n = 0;
    for (const { snapshot } of this.series.values()) {
      if (snapshot.name === name) n += 1;
    }
    return n;
  }

  clear(): void {
    this.series.clear();
  }

  private createState(input: MetricsStoreApplyInput): MetricSeriesSnapshot['state'] {
    if (input.type === 'counter') {
      return { type: 'counter', value: Math.max(0, input.value) };
    }
    if (input.type === 'gauge') {
      return { type: 'gauge', value: input.value };
    }
    const bounds = input.histogramBounds ?? [];
    const counts = new Array(bounds.length + 1).fill(0);
    this.addHistogramSample(counts, bounds, input.value);
    return {
      type: 'histogram',
      counts,
      sum: input.value,
      count: 1,
      bounds,
    };
  }

  private updateState(
    state: MetricSeriesSnapshot['state'],
    input: MetricsStoreApplyInput,
  ): void {
    if (state.type === 'counter' && input.type === 'counter') {
      (state as CounterSeriesState).value += Math.max(0, input.value);
      return;
    }
    if (state.type === 'gauge' && input.type === 'gauge') {
      (state as GaugeSeriesState).value = input.value;
      return;
    }
    if (state.type === 'histogram' && input.type === 'histogram') {
      const hist = state as HistogramSeriesState;
      this.addHistogramSample(hist.counts, hist.bounds, input.value);
      hist.sum += input.value;
      hist.count += 1;
    }
  }

  private addHistogramSample(
    counts: number[],
    bounds: readonly number[],
    value: number,
  ): void {
    let placed = false;
    for (let i = 0; i < bounds.length; i++) {
      if (value <= bounds[i]!) {
        counts[i]! += 1;
        placed = true;
        break;
      }
    }
    if (!placed) {
      counts[bounds.length]! += 1;
    }
  }

  private cloneState(
    state: MetricSeriesSnapshot['state'],
  ): MetricSeriesSnapshot['state'] {
    if (state.type === 'histogram') {
      return {
        type: 'histogram',
        counts: [...state.counts],
        sum: state.sum,
        count: state.count,
        bounds: state.bounds,
      };
    }
    return { ...state };
  }
}
