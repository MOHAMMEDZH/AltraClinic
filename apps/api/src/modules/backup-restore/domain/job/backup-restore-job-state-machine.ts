import type { BackupRestoreJobStatus } from './backup-restore-job.types';

/**
 * Phase 43b — formal Backup & Restore job state machine.
 * Illegal transitions throw. No execution side effects.
 */
export const BACKUP_RESTORE_JOB_TRANSITIONS: Readonly<
  Record<BackupRestoreJobStatus, readonly BackupRestoreJobStatus[]>
> = {
  created: ['queued', 'validating', 'cancelled', 'expired', 'failed'],
  queued: ['validating', 'waiting', 'running', 'cancelling', 'cancelled', 'expired'],
  validating: ['waiting', 'queued', 'running', 'failed', 'cancelling', 'cancelled'],
  waiting: ['running', 'queued', 'cancelling', 'cancelled', 'expired'],
  running: [
    'paused',
    'verification_pending',
    'completed',
    'failed',
    'cancelling',
    'cancelled',
  ],
  paused: ['running', 'cancelling', 'cancelled', 'expired'],
  cancelling: ['cancelled', 'failed'],
  cancelled: [],
  completed: ['verification_pending', 'expired'],
  failed: ['retrying', 'dead_letter', 'cancelled', 'expired'],
  verification_pending: ['verified', 'failed', 'cancelling', 'cancelled'],
  verified: ['expired'],
  retrying: ['queued', 'cancelled', 'dead_letter', 'expired'],
  dead_letter: [],
  expired: [],
};

export class IllegalBackupRestoreJobTransitionError extends Error {
  constructor(
    public readonly from: BackupRestoreJobStatus,
    public readonly to: BackupRestoreJobStatus,
  ) {
    super(`Illegal backup-restore job transition: ${from} → ${to}`);
    this.name = 'IllegalBackupRestoreJobTransitionError';
  }
}

export function canTransitionBackupRestoreJobStatus(
  from: BackupRestoreJobStatus,
  to: BackupRestoreJobStatus,
): boolean {
  return BACKUP_RESTORE_JOB_TRANSITIONS[from].includes(to);
}

export function assertBackupRestoreJobTransition(
  from: BackupRestoreJobStatus,
  to: BackupRestoreJobStatus,
): void {
  if (!canTransitionBackupRestoreJobStatus(from, to)) {
    throw new IllegalBackupRestoreJobTransitionError(from, to);
  }
}

export function isTerminalBackupRestoreJobStatus(status: BackupRestoreJobStatus): boolean {
  return BACKUP_RESTORE_JOB_TRANSITIONS[status].length === 0;
}

export function isCancellableBackupRestoreJobStatus(status: BackupRestoreJobStatus): boolean {
  return (
    status === 'created' ||
    status === 'queued' ||
    status === 'validating' ||
    status === 'waiting' ||
    status === 'running' ||
    status === 'paused' ||
    status === 'retrying' ||
    status === 'verification_pending'
  );
}

export function isActiveLockStatus(status: BackupRestoreJobStatus): boolean {
  return status === 'running' || status === 'validating' || status === 'cancelling';
}
