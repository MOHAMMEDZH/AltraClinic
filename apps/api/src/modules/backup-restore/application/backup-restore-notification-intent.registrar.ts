import { Injectable, Logger } from '@nestjs/common';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';

/**
 * Intent kinds — register / record only — no delivery.
 */
export type BackupRestoreJobNotificationKind =
  | 'job_queued'
  | 'job_started'
  | 'job_completed'
  | 'job_failed'
  | 'job_cancelled'
  | 'verification_pending'
  | 'verification_requested'
  | 'verification_completed'
  | 'verification_failed'
  | 'backup_started'
  | 'backup_succeeded'
  | 'backup_failed'
  | 'snapshot_registered'
  | 'snapshot_expired'
  | 'cleanup_planned'
  | 'retention_policy_violation'
  | 'retention_evaluated'
  | 'restore_started'
  | 'restore_completed'
  | 'restore_failed'
  | 'recovery_point_selected'
  | 'restore_validation_failed'
  | 'drill_overdue';

export interface NotificationIntentEntityRef {
  id: string;
  tenantId: string;
  correlationId: string;
}

/**
 * Notification intent registration only.
 * Does NOT call Notification Delivery / Phase 41 producer.
 */
@Injectable()
export class BackupRestoreNotificationIntentRegistrar {
  private readonly logger = new Logger(BackupRestoreNotificationIntentRegistrar.name);
  private readonly registered: Array<{ kind: BackupRestoreJobNotificationKind; jobId: string }> =
    [];

  listRegisteredKinds(): readonly BackupRestoreJobNotificationKind[] {
    return [
      'job_queued',
      'job_started',
      'job_completed',
      'job_failed',
      'job_cancelled',
      'verification_pending',
      'verification_requested',
      'verification_completed',
      'verification_failed',
      'backup_started',
      'backup_succeeded',
      'backup_failed',
      'snapshot_registered',
      'snapshot_expired',
      'cleanup_planned',
      'retention_policy_violation',
      'retention_evaluated',
      'restore_started',
      'restore_completed',
      'restore_failed',
      'recovery_point_selected',
      'restore_validation_failed',
      'drill_overdue',
    ];
  }

  drainRegistered() {
    const copy = [...this.registered];
    this.registered.length = 0;
    return copy;
  }

  async registerIntent(
    kind: BackupRestoreJobNotificationKind,
    job: BackupRestoreJob,
  ): Promise<void> {
    return this.registerIntentForEntity(kind, {
      id: job.id,
      tenantId: job.tenantId,
      correlationId: job.correlationId,
    });
  }

  /** Phase 43d — intents for verification/retention entities (no job required). */
  async registerIntentForEntity(
    kind: BackupRestoreJobNotificationKind,
    entity: NotificationIntentEntityRef,
  ): Promise<void> {
    this.registered.push({ kind, jobId: entity.id });
    this.logger.log(
      JSON.stringify({
        kind: BACKUP_RESTORE_LOG_KIND,
        component: 'notification_intent',
        event: 'registered',
        notificationKind: kind,
        jobId: entity.id,
        tenantId: entity.tenantId,
        correlationId: entity.correlationId,
        delivery: false,
      }),
    );
  }
}
