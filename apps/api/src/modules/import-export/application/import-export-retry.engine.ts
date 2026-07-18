import type { ImportExportJob, JobRetryPolicy } from '../domain/job/import-export-job.types';
import { DEFAULT_JOB_RETRY_POLICY } from '../domain/job/import-export-job.types';

export interface RetryDecision {
  shouldRetry: boolean;
  shouldDeadLetter: boolean;
  delayMs: number;
  nextAttempt: number;
  reason: string;
}

/**
 * Phase 42c — orchestration retry engine (no adapter retry).
 */
export class ImportExportRetryEngine {
  constructor(private readonly defaults: JobRetryPolicy = DEFAULT_JOB_RETRY_POLICY) {}

  decide(job: ImportExportJob, errorMessage?: string): RetryDecision {
    const maxAttempts = job.maxAttempts || this.defaults.maxAttempts;
    // attemptCount is incremented when the job starts; after a failure it reflects attempts used.
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
    const delayMs = Math.min(maxDelay, base * Math.pow(2, Math.max(0, job.attemptCount - 1)));

    return {
      shouldRetry: true,
      shouldDeadLetter: false,
      delayMs,
      nextAttempt: job.attemptCount + 1,
      reason: errorMessage ?? 'retryable_orchestration_failure',
    };
  }
}
