/**
 * Phase 45d — tracing contributor helpers (API / queue / job / hub / async).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  TRACING_SERVICE,
  type TracingService,
} from '../ports/services';
import { CorrelationContextService } from '../logging/correlation-context.service';
import type { StartSpanInput, TraceContext } from '../../domain/tracing.types';
import { InProcessTracingService } from './in-process-tracing.service';

@Injectable()
export class ApiTracingContributor {
  constructor(
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    private readonly correlation: CorrelationContextService,
  ) {}

  startRequestSpan(input: {
    method: string;
    routeTemplate?: string;
    tenantId?: string | null;
    parent?: TraceContext;
  }): { ok: boolean; context?: TraceContext; reason?: string } {
    return (
      this.tracing.startSpan?.({
        name: `HTTP ${input.method}`,
        kind: 'server',
        parent: input.parent,
        tenantId: input.tenantId,
        correlationId: this.correlation.getCorrelationId(),
        component: 'http',
        attributes: {
          method: input.method.toUpperCase(),
          ...(input.routeTemplate
            ? { http_route_template: input.routeTemplate }
            : {}),
        },
      }) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class QueueTracingContributor {
  constructor(
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    private readonly correlation: CorrelationContextService,
  ) {}

  async withQueueSpan<T>(
    payload: {
      traceparent?: unknown;
      traceId?: unknown;
      spanId?: unknown;
      correlationId?: unknown;
    },
    meta: { queue: string; tenantId?: string | null },
    fn: () => Promise<T>,
  ): Promise<T> {
    const parent = this.tracing.contextFromPropagation?.({
      traceparent: payload.traceparent,
      traceId: payload.traceId,
      spanId: payload.spanId,
      correlationId: payload.correlationId,
      tenantId: meta.tenantId,
    });

    const input: StartSpanInput = {
      name: `queue.${meta.queue}`,
      kind: 'consumer',
      parent,
      tenantId: meta.tenantId,
      correlationId:
        typeof payload.correlationId === 'string'
          ? payload.correlationId
          : this.correlation.getCorrelationId(),
      component: 'queue',
      attributes: { queue: meta.queue, operation: 'consume' },
    };

    if (this.tracing.runWithSpanAsync) {
      return this.tracing.runWithSpanAsync(input, fn);
    }
    return fn();
  }
}

@Injectable()
export class JobTracingContributor {
  constructor(
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    private readonly correlation: CorrelationContextService,
  ) {}

  async withJobSpan<T>(
    meta: {
      jobName: string;
      tenantId?: string | null;
      parent?: TraceContext;
      correlationId?: string;
    },
    fn: () => Promise<T>,
  ): Promise<T> {
    const input: StartSpanInput = {
      name: `job.${meta.jobName}`,
      kind: 'internal',
      parent: meta.parent,
      tenantId: meta.tenantId,
      correlationId: meta.correlationId ?? this.correlation.getCorrelationId(),
      component: 'background_job',
      attributes: { job_name: meta.jobName, operation: 'run' },
    };
    if (this.tracing.runWithSpanAsync) {
      return this.tracing.runWithSpanAsync(input, fn);
    }
    return fn();
  }
}

@Injectable()
export class HubTracingContributor {
  constructor(
    @Inject(TRACING_SERVICE) private readonly tracing: TracingService,
    private readonly correlation: CorrelationContextService,
  ) {}

  runHubSpan<T>(
    hub: string,
    operation: string,
    fn: () => T,
    tenantId?: string | null,
  ): T {
    const input: StartSpanInput = {
      name: `hub.${hub}.${operation}`,
      kind: 'internal',
      tenantId,
      correlationId: this.correlation.getCorrelationId(),
      component: 'hub',
      attributes: { hub, operation, outcome: 'ok' },
    };
    if (this.tracing.runWithSpan) {
      return this.tracing.runWithSpan(input, fn);
    }
    return fn();
  }
}

@Injectable()
export class AsyncTracingContributor {
  constructor(
    private readonly tracing: InProcessTracingService,
  ) {}

  /**
   * Propagate active span across an async boundary (ALS).
   */
  async continueAsync<T>(fn: () => Promise<T>): Promise<T> {
    const active = this.tracing.getActiveContext();
    if (!active || !this.tracing.isActive()) {
      return fn();
    }
    return this.tracing.runWithSpanAsync(
      {
        name: 'async.continuation',
        kind: 'internal',
        parent: active,
        component: 'async',
        attributes: { operation: 'continue' },
      },
      fn,
    );
  }
}
