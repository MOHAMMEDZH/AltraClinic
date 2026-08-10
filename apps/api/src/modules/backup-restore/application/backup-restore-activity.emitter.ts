import { Injectable, Logger } from '@nestjs/common';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';

export type BackupRestoreActivityEvent =
  | 'job_created'
  | 'job_queued'
  | 'job_started'
  | 'job_paused'
  | 'job_resumed'
  | 'job_completed'
  | 'job_failed'
  | 'job_retry'
  | 'job_dead_letter'
  | 'job_cancelled'
  | 'job_expired'
  | 'backup_created'
  | 'backup_started'
  | 'backup_completed'
  | 'backup_failed'
  | 'restore_requested'
  | 'restore_approved'
  | 'restore_started'
  | 'restore_completed'
  | 'restore_failed'
  | 'restore_validated'
  | 'recovery_point_selected'
  | 'drill_started'
  | 'drill_completed'
  | 'verification_started'
  | 'verification_completed'
  | 'verification_failed'
  | 'retention_evaluated'
  | 'snapshot_expired'
  | 'cleanup_planned';

export interface BackupRestoreActivityPayload {
  tenantId: string;
  branchId?: string | null;
  jobId: string;
  kind?: string;
  typeId?: string;
  status?: string;
  correlationId?: string;
  reason?: string;
}

/**
 * Phase 43b — Activity lifecycle emit (structured logs).
 * Does not redesign Activity Center. No execution events.
 */
@Injectable()
export class BackupRestoreActivityEmitterService {
  private readonly logger = new Logger(BackupRestoreActivityEmitterService.name);
  private readonly emitted: Array<{
    event: BackupRestoreActivityEvent;
    payload: BackupRestoreActivityPayload;
  }> = [];

  drainEmitted() {
    const copy = [...this.emitted];
    this.emitted.length = 0;
    return copy;
  }

  async emit(
    event: BackupRestoreActivityEvent,
    payload: BackupRestoreActivityPayload,
  ): Promise<void> {
    this.emitted.push({ event, payload });
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'activity',
      event,
      tenantId: payload.tenantId,
      branchId: payload.branchId ?? null,
      jobId: payload.jobId,
      jobKind: payload.kind ?? null,
      typeId: payload.typeId ?? null,
      status: payload.status ?? null,
      correlationId: payload.correlationId ?? null,
      reason: payload.reason ?? null,
    });
  }
}
