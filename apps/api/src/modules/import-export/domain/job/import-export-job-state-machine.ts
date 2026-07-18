import type { JobStatus } from './import-export-job.types';

/**
 * Strict Import/Export job lifecycle transitions.
 * Illegal transitions throw.
 */
export const JOB_STATUS_TRANSITIONS: Readonly<Record<JobStatus, readonly JobStatus[]>> = {
  draft: ['queued', 'cancelled', 'expired', 'failed'],
  queued: ['running', 'cancelled', 'expired'],
  running: ['completed', 'completed_with_warnings', 'failed', 'cancelled'],
  completed: ['expired'],
  completed_with_warnings: ['expired'],
  cancelled: [],
  failed: ['retrying', 'dead_letter', 'cancelled', 'expired'],
  retrying: ['queued', 'cancelled', 'dead_letter', 'expired'],
  dead_letter: [],
  expired: [],
};

export class IllegalJobTransitionError extends Error {
  constructor(
    public readonly from: JobStatus,
    public readonly to: JobStatus,
  ) {
    super(`Illegal job transition: ${from} → ${to}`);
    this.name = 'IllegalJobTransitionError';
  }
}

export function canTransitionJobStatus(from: JobStatus, to: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[from].includes(to);
}

export function assertJobTransition(from: JobStatus, to: JobStatus): void {
  if (!canTransitionJobStatus(from, to)) {
    throw new IllegalJobTransitionError(from, to);
  }
}

export function isTerminalJobStatus(status: JobStatus): boolean {
  return JOB_STATUS_TRANSITIONS[status].length === 0;
}

export function isCancellableJobStatus(status: JobStatus): boolean {
  return status === 'draft' || status === 'queued' || status === 'retrying' || status === 'running';
}
