import type {
  BackupRestoreJob,
  BackupRestoreJobRetryPolicy,
} from '../domain/job/backup-restore-job.types';
import { DEFAULT_BACKUP_RESTORE_RETRY_POLICY } from '../domain/job/backup-restore-job.types';

export interface BackupRestoreRetryDecision {
  shouldRetry: boolean;
  shouldDeadLetter: boolean;
  delayMs: number;
  nextAttempt: number;
  reason: string;
}

/**
 * Phase 43b — retry decision metadata only. No retry worker.
 */
export class BackupRestoreRetryEngine {
  constructor(
    private readonly defaults: BackupRestoreJobRetryPolicy = DEFAULT_BACKUP_RESTORE_RETRY_POLICY,
  ) {}

  decide(job: BackupRestoreJob, errorMessage?: string): BackupRestoreRetryDecision {
    const maxAttempts = job.maxAttempts || this.defaults.maxAttempts;
    if (job.attemptCount >= maxAttempts) {
      return {
        shouldRetry: false,
        shouldDeadLetter: true,
        delayMs: 0,
        nextAttempt: job.attemptCount,
        reason: errorMessage ?? 'max_attempts_exceeded',
      };
    }

    const base = job.baseDelayMs || this.defaults.baseDelayMs;
    const maxDelay = job.maxDelayMs || this.defaults.maxDelayMs;
    const delayMs = Math.min(
      maxDelay,
      base * Math.pow(2, Math.max(0, job.attemptCount - 1)),
    );

    return {
      shouldRetry: true,
      shouldDeadLetter: false,
      delayMs,
      nextAttempt: job.attemptCount + 1,
      reason: errorMessage ?? 'retryable_orchestration_failure',
    };
  }
}
