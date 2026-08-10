/**
 * Phase 45c — logging contributor helpers (API / queue / job / hub).
 */
import { Inject, Injectable } from '@nestjs/common';
import {
  LOGGING_PIPELINE,
  type LoggingPipelineService,
} from '../ports/services';
import { CorrelationContextService } from './correlation-context.service';
import type { LogWriteResult } from '../../domain/logging.types';

@Injectable()
export class ApiLoggingContributor {
  constructor(
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    private readonly correlation: CorrelationContextService,
  ) {}

  logRequest(input: {
    tenantId?: string | null;
    method: string;
    statusClass: string;
    pathTemplate?: string;
    durationMs?: number;
  }): LogWriteResult {
    return (
      this.logging.write?.({
        severity: 'info',
        category: 'api',
        event: 'api.request',
        message: 'api_request',
        module: 'api',
        operation: 'http_request',
        source: 'http',
        component: 'http',
        tenantId: input.tenantId,
        attributes: {
          method: input.method.toUpperCase(),
          status_class: input.statusClass,
          ...(input.pathTemplate
            ? { path_template: input.pathTemplate }
            : {}),
          ...(input.durationMs != null
            ? { duration_ms: input.durationMs }
            : {}),
        },
      }) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class QueueLoggingContributor {
  constructor(
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    private readonly correlation: CorrelationContextService,
  ) {}

  /**
   * Run work under queue correlation context and emit a structured log.
   */
  async withQueueContext<T>(
    payload: { correlationId?: unknown; causationId?: unknown },
    meta: { queue: string; tenantId?: string | null },
    fn: () => Promise<T>,
  ): Promise<T> {
    const ctx = this.correlation.contextFromPayload(payload, {
      source: 'queue',
      module: 'queue',
      tenantId: meta.tenantId,
      operation: meta.queue,
    });
    return this.correlation.runWithContextAsync(ctx, async () => {
      this.logging.write?.({
        severity: 'info',
        category: 'queue',
        event: 'queue.job_start',
        message: 'queue_job_start',
        module: 'queue',
        operation: 'consume',
        source: 'queue',
        tenantId: meta.tenantId,
        attributes: { queue: meta.queue },
      });
      return fn();
    });
  }

  logFailure(queue: string, outcome = 'failed'): LogWriteResult {
    return (
      this.logging.write?.({
        severity: 'error',
        category: 'queue',
        event: 'queue.job_failed',
        message: 'queue_job_failed',
        module: 'queue',
        operation: 'consume',
        source: 'queue',
        attributes: { queue, outcome },
      }) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}

@Injectable()
export class JobLoggingContributor {
  constructor(
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
    private readonly correlation: CorrelationContextService,
  ) {}

  async withJobContext<T>(
    payload: { correlationId?: unknown; causationId?: unknown },
    meta: { jobName: string; tenantId?: string | null },
    fn: () => Promise<T>,
  ): Promise<T> {
    const ctx = this.correlation.contextFromPayload(payload, {
      source: 'job',
      module: 'background',
      tenantId: meta.tenantId,
      operation: meta.jobName,
    });
    return this.correlation.runWithContextAsync(ctx, async () => {
      this.logging.write?.({
        severity: 'info',
        category: 'job',
        event: 'job.start',
        message: 'background_job_start',
        module: 'background',
        operation: meta.jobName,
        source: 'job',
        tenantId: meta.tenantId,
        attributes: { job_name: meta.jobName },
      });
      return fn();
    });
  }
}

@Injectable()
export class HubLoggingContributor {
  constructor(
    @Inject(LOGGING_PIPELINE) private readonly logging: LoggingPipelineService,
  ) {}

  logHubEvent(input: {
    hub: string;
    event: string;
    tenantId?: string | null;
    outcome?: string;
    severity?: 'info' | 'warn' | 'error';
  }): LogWriteResult {
    return (
      this.logging.write?.({
        severity: input.severity ?? 'info',
        category: 'hub',
        event: input.event,
        message: 'hub_event',
        module: input.hub,
        operation: 'hub',
        source: 'internal',
        tenantId: input.tenantId,
        attributes: {
          hub: input.hub,
          outcome: input.outcome ?? 'ok',
        },
      }) ?? { ok: false, reason: 'pipeline_inactive' }
    );
  }
}
