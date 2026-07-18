import { Injectable, Logger } from '@nestjs/common';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { IMPORT_EXPORT_LOG_KIND, IMPORT_EXPORT_QUEUE_NAME } from '../import-export.constants';

export type ImportExportActivityEvent =
  | 'job_created'
  | 'job_queued'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_retry'
  | 'job_dead_letter'
  | 'job_cancelled'
  | 'job_expired';

export interface ImportExportActivityPayload {
  tenantId: string;
  branchId?: string | null;
  jobId: string;
  typeId?: string;
  direction?: string;
  status?: string;
  correlationId?: string;
  reason?: string;
}

/**
 * Phase 42c — observational Activity emit (structured logs + metrics).
 * Does not redesign Activity Center.
 */
@Injectable()
export class ImportExportActivityEmitterService {
  private readonly logger = new Logger(ImportExportActivityEmitterService.name);
  private readonly emitted: Array<{ event: ImportExportActivityEvent; payload: ImportExportActivityPayload }> =
    [];

  constructor(private readonly queueMetrics: QueueMetricsService) {}

  /** Test helper */
  drainEmitted() {
    const copy = [...this.emitted];
    this.emitted.length = 0;
    return copy;
  }

  async emit(event: ImportExportActivityEvent, payload: ImportExportActivityPayload): Promise<void> {
    this.emitted.push({ event, payload });
    this.logger.log({
      kind: IMPORT_EXPORT_LOG_KIND,
      component: 'activity',
      event,
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      jobId: payload.jobId,
      typeId: payload.typeId ?? null,
      direction: payload.direction ?? null,
      status: payload.status ?? null,
      correlationId: payload.correlationId ?? null,
      reason: payload.reason ?? null,
    });

    try {
      if (event === 'job_queued' || event === 'job_retry') {
        await this.queueMetrics.recordEnqueued(`${IMPORT_EXPORT_QUEUE_NAME}:${event}`);
      } else if (event === 'job_completed') {
        await this.queueMetrics.recordCompleted(`${IMPORT_EXPORT_QUEUE_NAME}:completed`);
      } else if (event === 'job_failed' || event === 'job_dead_letter') {
        await this.queueMetrics.recordFailed(`${IMPORT_EXPORT_QUEUE_NAME}:${event}`);
      }
    } catch {
      // Observability must not break orchestration.
    }
  }
}
