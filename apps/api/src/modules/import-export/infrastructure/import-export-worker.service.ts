import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import { BullMqConnectionService } from '../../background/infrastructure/bullmq-connection.service';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import { IMPORT_EXPORT_JOB_QUEUE_JOB_NAME } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND, IMPORT_EXPORT_QUEUE_NAME } from '../import-export.constants';
import { ImportExportJobService } from '../application/import-export-job.service';
import type { ImportExportQueuePayload } from './import-export-queue.service';

function backgroundWorkersEnabled(): boolean {
  if (process.env.NODE_ENV === 'test') return false;
  if (process.env.BACKGROUND_WORKERS_ENABLED === 'false') return false;
  return true;
}

/**
 * Phase 42c — worker processes orchestration jobs via Null Executor only.
 */
@Injectable()
export class ImportExportWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ImportExportWorkerService.name);
  private worker?: Worker;
  private ready = false;
  private status: 'disabled' | 'idle' | 'ready' = 'disabled';
  private disableReason: string | null = null;
  private jobsProcessed = 0;
  private readonly workerId = `ie-worker-${process.pid}`;

  constructor(
    private readonly bullMq: BullMqConnectionService,
    private readonly jobService: ImportExportJobService,
  ) {}

  getHealth(): {
    status: 'disabled' | 'idle' | 'ready';
    ready: boolean;
    queue: string;
    jobsProcessed: number;
    featureEnabled: boolean;
    disableReason: string | null;
    workerId: string;
    processor: string;
  } {
    return {
      status: this.status,
      ready: this.ready,
      queue: IMPORT_EXPORT_QUEUE_NAME,
      jobsProcessed: this.jobsProcessed,
      featureEnabled: isImportExportCenterEnabled(),
      disableReason: this.disableReason,
      workerId: this.workerId,
      processor: IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
    };
  }

  onModuleInit(): void {
    const featureEnabled = isImportExportCenterEnabled();
    if (!featureEnabled) {
      this.status = 'disabled';
      this.disableReason = 'IMPORT_EXPORT_CENTER_ENABLED=false';
      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'worker',
          event: 'disabled',
          reason: this.disableReason,
          queue: IMPORT_EXPORT_QUEUE_NAME,
        }),
      );
      return;
    }

    if (!backgroundWorkersEnabled()) {
      this.status = 'disabled';
      this.disableReason = 'NODE_ENV=test or BACKGROUND_WORKERS_ENABLED=false';
      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'worker',
          event: 'disabled',
          reason: this.disableReason,
          queue: IMPORT_EXPORT_QUEUE_NAME,
        }),
      );
      return;
    }

    this.worker = new Worker(
      IMPORT_EXPORT_QUEUE_NAME,
      async (bullJob) => {
        const payload = bullJob.data as ImportExportQueuePayload;
        this.logger.log(
          JSON.stringify({
            kind: IMPORT_EXPORT_LOG_KIND,
            component: 'worker',
            event: 'lease',
            workerId: this.workerId,
            jobId: payload.jobId,
            tenantId: payload.tenantId,
            correlationId: payload.correlationId,
          }),
        );
        const result = await this.jobService.processQueuedJob(
          payload.tenantId,
          payload.jobId,
          this.workerId,
        );
        this.jobsProcessed += 1;
        return {
          jobId: result.id,
          status: result.status,
          executor: 'NullImportExportExecutor',
          businessWork: false,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- ioredis dual-package type
      { connection: this.bullMq.connection as any, concurrency: 2 },
    );

    this.status = 'idle';
    this.worker.on('ready', () => {
      this.ready = true;
      this.status = 'ready';
      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'worker',
          event: 'ready',
          queue: IMPORT_EXPORT_QUEUE_NAME,
          workerId: this.workerId,
          processor: IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
          nullExecutor: true,
        }),
      );
    });

    this.worker.on('failed', (job, err) => {
      this.logger.error(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'worker',
          event: 'failed',
          bullJobId: job?.id ?? null,
          message: err.message,
        }),
      );
    });

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'worker',
        event: 'initialized',
        queue: IMPORT_EXPORT_QUEUE_NAME,
        workerId: this.workerId,
        nullExecutor: true,
      }),
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
    this.ready = false;
  }
}
