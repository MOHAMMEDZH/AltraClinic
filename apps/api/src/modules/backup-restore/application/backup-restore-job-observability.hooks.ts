import { Injectable, Logger } from '@nestjs/common';
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_METRICS_NAMESPACE,
} from '../backup-restore.constants';
import type { BackupRestoreJobStatus } from '../domain/job/backup-restore-job.types';

/**
 * Phase 43b — instrumentation hooks only (counters in-memory for tests).
 * Does not push to external metrics backends.
 */
@Injectable()
export class BackupRestoreJobObservabilityHooks {
  private readonly logger = new Logger(BackupRestoreJobObservabilityHooks.name);
  private transitions = 0;
  private retries = 0;
  private failures = 0;
  private readonly stateCounters: Partial<Record<BackupRestoreJobStatus, number>> = {};

  drainCounters() {
    const snapshot = {
      transitions: this.transitions,
      retries: this.retries,
      failures: this.failures,
      stateCounters: { ...this.stateCounters },
    };
    this.transitions = 0;
    this.retries = 0;
    this.failures = 0;
    for (const key of Object.keys(this.stateCounters)) {
      delete this.stateCounters[key as BackupRestoreJobStatus];
    }
    return snapshot;
  }

  onTransition(
    from: BackupRestoreJobStatus,
    to: BackupRestoreJobStatus,
    correlationId: string,
  ): void {
    this.transitions += 1;
    this.stateCounters[to] = (this.stateCounters[to] ?? 0) + 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'observability',
      namespace: BACKUP_RESTORE_METRICS_NAMESPACE,
      event: 'transition',
      from,
      to,
      correlationId,
    });
  }

  onRetry(correlationId: string): void {
    this.retries += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'observability',
      event: 'retry',
      correlationId,
    });
  }

  onFailure(correlationId: string, failureClass: string): void {
    this.failures += 1;
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'observability',
      event: 'failure',
      failureClass,
      correlationId,
    });
  }
}
