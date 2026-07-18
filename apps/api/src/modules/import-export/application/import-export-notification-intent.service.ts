import { Injectable, Logger, Optional } from '@nestjs/common';
import { NotificationIntentProducerService } from '../../notifications/delivery/notification-intent-producer.service';
import type { ImportExportJob } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';

export type ImportExportNotificationKind =
  | 'import_completed'
  | 'export_completed'
  | 'export_failed'
  | 'artifact_available'
  | 'job_failed'
  | 'retry_scheduled'
  | 'dead_letter_reached';

/**
 * Phase 42c — Notification Intents only via Phase 41 producer API.
 */
@Injectable()
export class ImportExportNotificationIntentService {
  private readonly logger = new Logger(ImportExportNotificationIntentService.name);
  private readonly produced: Array<{ kind: ImportExportNotificationKind; jobId: string }> = [];

  constructor(
    @Optional() private readonly producer?: NotificationIntentProducerService,
  ) {}

  drainProduced() {
    const copy = [...this.produced];
    this.produced.length = 0;
    return copy;
  }

  async notify(kind: ImportExportNotificationKind, job: ImportExportJob): Promise<void> {
    this.produced.push({ kind, jobId: job.id });
    const title = titleFor(kind, job);
    const body = bodyFor(kind, job);

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'notification_intent',
        event: 'produce',
        notificationKind: kind,
        jobId: job.id,
        tenantId: job.tenantId,
        correlationId: job.correlationId,
      }),
    );

    if (!this.producer) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'notification_intent',
          event: 'producer_unavailable',
          jobId: job.id,
        }),
      );
      return;
    }

    try {
      await this.producer.produceInApp({
        tenantId: job.tenantId,
        branchId: job.branchId,
        recipientId: job.initiatedByUserId,
        title,
        body,
        priority:
          kind === 'dead_letter_reached' || kind === 'job_failed' || kind === 'export_failed'
            ? 'high'
            : 'medium',
        category: 'import_export',
        notificationTypeId: `import_export.${kind}`,
        idempotencyKey: `import-export:${job.id}:${kind}:${job.attemptCount}`,
        producerModuleId: 'import-export.job-engine',
        correlationId: job.correlationId,
        causationId: job.id,
        metadata: {
          jobId: job.id,
          typeId: job.typeId,
          direction: job.direction,
          status: job.status,
          orchestrationOnly: true,
        },
      });
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'notification_intent',
          event: 'produce_failed',
          jobId: job.id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
}

function titleFor(kind: ImportExportNotificationKind, job: ImportExportJob): string {
  switch (kind) {
    case 'import_completed':
      return 'Import completed';
    case 'export_completed':
      return 'Export completed';
    case 'export_failed':
      return 'Export failed';
    case 'artifact_available':
      return 'Export artifact available';
    case 'job_failed':
      return 'Import/Export job failed';
    case 'retry_scheduled':
      return 'Import/Export retry scheduled';
    case 'dead_letter_reached':
      return 'Import/Export job dead-lettered';
    default:
      return `Import/Export job ${job.status}`;
  }
}

function bodyFor(kind: ImportExportNotificationKind, job: ImportExportJob): string {
  return `Job ${job.id} (${job.typeId}/${job.direction}) — ${kind.replace(/_/g, ' ')}. Orchestration only; no business data processed.`;
}
