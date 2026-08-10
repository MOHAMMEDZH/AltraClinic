/**
 * Phase 45b — instrumentation extension contracts for API / queue / hub / DB (OD-API-OBS, OD-QUEUE-OBS, OD-HUB-OBS, OD-DB).
 * Thin helpers over the metrics pipeline; no hub engine redesign.
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  METRICS_PIPELINE,
  type MetricsPipelineService,
} from '../ports/services';
import type { MetricLabels, MetricRecordResult } from '../../domain/metrics.types';

@Injectable()
export class ApiMetricsContributor {
  constructor(
    @Inject(METRICS_PIPELINE) private readonly pipeline: MetricsPipelineService,
  ) {}

  recordRequest(input: {
    tenantId?: string | null;
    method: string;
    statusClass: string;
    latencyMs?: number;
  }): { request: MetricRecordResult; latency?: MetricRecordResult } {
    const labels: MetricLabels = {
      service: 'api',
      component: 'http',
      method: input.method.toUpperCase(),
      status_class: input.statusClass,
    };
    const request =
      this.pipeline.increment?.(
        'observability.api.requests',
        labels,
        input.tenantId,
      ) ?? { ok: false, reason: 'pipeline_inactive' };
    let latency: MetricRecordResult | undefined;
    if (input.latencyMs != null) {
      latency =
        this.pipeline.observeHistogram?.(
          'observability.api.latency_ms',
          input.latencyMs,
          labels,
          input.tenantId,
        ) ?? { ok: false, reason: 'pipeline_inactive' };
    }
    return { request, latency };
  }

  recordError(input: {
    tenantId?: string | null;
    errorClass: string;
    statusClass: string;
  }): MetricRecordResult {
    return (
      this.pipeline.increment?.(
        'observability.api.errors',
        {
          service: 'api',
          component: 'http',
          error_class: input.errorClass,
          status_class: input.statusClass,
        },
        input.tenantId,
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class QueueMetricsContributor {
  constructor(
    @Inject(METRICS_PIPELINE) private readonly pipeline: MetricsPipelineService,
  ) {}

  setDepth(queue: string, depth: number): MetricRecordResult {
    return (
      this.pipeline.setGauge?.(
        'observability.queue.depth',
        depth,
        { queue, service: 'queue', component: 'bullmq' },
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }

  recordFailure(queue: string, outcome = 'failed'): MetricRecordResult {
    return (
      this.pipeline.increment?.(
        'observability.queue.failures',
        { queue, outcome, service: 'queue', component: 'bullmq' },
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class HubMetricsContributor {
  constructor(
    @Inject(METRICS_PIPELINE) private readonly pipeline: MetricsPipelineService,
  ) {}

  recordJobFailure(input: {
    hub: string;
    tenantId?: string | null;
    outcome?: string;
  }): MetricRecordResult {
    return (
      this.pipeline.increment?.(
        'observability.hub.job_failures',
        {
          hub: input.hub,
          outcome: input.outcome ?? 'failed',
          service: 'hub',
          component: input.hub,
        },
        input.tenantId,
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class DatabaseMetricsContributor {
  constructor(
    @Inject(METRICS_PIPELINE) private readonly pipeline: MetricsPipelineService,
  ) {}

  setPoolSaturation(dependency: string, ratio: number): MetricRecordResult {
    const clamped = Math.min(1, Math.max(0, ratio));
    return (
      this.pipeline.setGauge?.(
        'observability.db.pool_saturation',
        clamped,
        { dependency, service: 'db', component: 'pool' },
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }

  setCacheHitRatio(dependency: string, ratio: number): MetricRecordResult {
    const clamped = Math.min(1, Math.max(0, ratio));
    return (
      this.pipeline.setGauge?.(
        'observability.cache.hit_ratio',
        clamped,
        { dependency, service: 'cache', component: 'redis' },
      ) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}
