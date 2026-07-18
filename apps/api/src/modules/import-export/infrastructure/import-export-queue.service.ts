import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { JobsOptions, Queue } from 'bullmq';
import { BullMqConnectionService } from '../../background/infrastructure/bullmq-connection.service';
import { QueueMetricsService } from '../../../infrastructure/redis/services/queue-metrics.service';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import {
  IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
} from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND, IMPORT_EXPORT_QUEUE_NAME } from '../import-export.constants';

export interface ImportExportQueuePayload {
  jobId: string;
  tenantId: string;
  correlationId: string;
}

/**
 * Phase 42c — BullMQ queue `import-export` with enqueue support.
 * Payload is orchestration IDs only (no business data).
 */
@Injectable()
export class ImportExportQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportExportQueueService.name);
  private queue?: Queue;
  private connected = false;
  private enqueuedCount = 0;

  constructor(
    private readonly bullMq: BullMqConnectionService,
    private readonly metrics: QueueMetricsService,
  ) {}

  get queueName(): string {
    return IMPORT_EXPORT_QUEUE_NAME;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getEnqueuedCount(): number {
    return this.enqueuedCount;
  }

  onModuleInit(): void {
    this.queue = new Queue(IMPORT_EXPORT_QUEUE_NAME, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis dual-package type
      connection: this.bullMq.connection as any,
    });
    this.connected = true;
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'queue',
        event: 'registered',
        queue: IMPORT_EXPORT_QUEUE_NAME,
        featureEnabled: isImportExportCenterEnabled(),
        enqueueEnabled: true,
      }),
    );
  }

  async enqueueJob(
    payload: ImportExportQueuePayload,
    options: JobsOptions = {},
  ): Promise<string | undefined> {
    if (!this.queue) {
      throw new Error('Import/Export queue is not initialized');
    }
    const job = await this.queue.add(IMPORT_EXPORT_JOB_QUEUE_JOB_NAME, payload, {
      removeOnComplete: 200,
      removeOnFail: 100,
      attempts: 1, // orchestration retries are owned by Job Engine, not BullMQ
      ...options,
    });
    this.enqueuedCount += 1;
    try {
      await this.metrics.recordEnqueued(IMPORT_EXPORT_QUEUE_NAME);
    } catch {
      /* ignore */
    }
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'queue',
        event: 'enqueued',
        queue: IMPORT_EXPORT_QUEUE_NAME,
        bullJobId: job.id,
        jobId: payload.jobId,
        tenantId: payload.tenantId,
        correlationId: payload.correlationId,
        delay: options.delay ?? 0,
      }),
    );
    return job.id;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
    this.connected = false;
  }
}
