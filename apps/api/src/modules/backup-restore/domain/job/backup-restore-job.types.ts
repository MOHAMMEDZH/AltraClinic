/**
 * Phase 43b — Backup & Restore Job Engine domain (orchestration metadata only).
 * No backup/restore payload. No adapters. No queue coupling.
 */

export type BackupRestoreJobKind = 'backup' | 'restore' | 'verification';

/**
 * Lifecycle states (brief + architecture).
 * `created` ≡ draft; `completed` ≡ succeeded; verification_* cover verify phase.
 */
export type BackupRestoreJobStatus =
  | 'created'
  | 'queued'
  | 'validating'
  | 'waiting'
  | 'running'
  | 'paused'
  | 'cancelling'
  | 'cancelled'
  | 'completed'
  | 'failed'
  | 'verification_pending'
  | 'verified'
  | 'retrying'
  | 'dead_letter'
  | 'expired';

export type BackupRestoreJobPriority = 'low' | 'normal' | 'high' | 'critical';

export type BackupRestoreFailureClass =
  | 'ValidationFailure'
  | 'PermissionFailure'
  | 'LicenseFailure'
  | 'ConfigurationFailure'
  | 'StorageFailure'
  | 'VerificationFailure'
  | 'SystemFailure'
  | 'UnknownFailure';

export type BackupRestoreCancelReason =
  | 'user'
  | 'system'
  | 'license'
  | 'feature_flag'
  | 'dependency_failure';

export interface BackupRestoreJobRetryPolicy {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface BackupRestoreJobProgress {
  percent: number;
  phase: string | null;
  step: number;
  stepCount: number;
  statusMessage: string | null;
  updatedAt: Date | null;
}

/** Orchestration metadata only — never dump bytes or restore payloads. */
export interface BackupRestoreJobMetadata {
  source: 'api' | 'system' | 'test';
  notes?: string;
  targetId?: string;
  policyId?: string;
  snapshotId?: string;
  restoreMode?: 'drill' | 'controlled';
  [key: string]: unknown;
}

export interface BackupRestoreJob {
  id: string;
  tenantId: string;
  branchId: string | null;
  kind: BackupRestoreJobKind;
  typeId: string;
  status: BackupRestoreJobStatus;
  priority: BackupRestoreJobPriority;
  initiatedByUserId: string;
  ownerUserId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  lastError: string | null;
  failureClass: BackupRestoreFailureClass | null;
  cancelReason: BackupRestoreCancelReason | null;
  progress: BackupRestoreJobProgress;
  metadata: BackupRestoreJobMetadata;
  /** Logical lock (lease) — not a distributed lock. */
  leasedAt: Date | null;
  leaseOwner: string | null;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
  expiresAt: Date | null;
  /** Transition history (append-only metadata). */
  transitions: readonly BackupRestoreJobTransitionRecord[];
  createdAt: Date;
  updatedAt: Date;
}

export interface BackupRestoreJobTransitionRecord {
  from: BackupRestoreJobStatus;
  to: BackupRestoreJobStatus;
  at: Date;
  actorId: string;
  reason?: string | null;
}

export interface BackupRestoreDeadLetterRecord {
  id: string;
  tenantId: string;
  jobId: string;
  reason: string;
  attempts: number;
  lastError: string | null;
  failureClass: BackupRestoreFailureClass | null;
  correlationId: string;
  createdAt: Date;
}

export const DEFAULT_BACKUP_RESTORE_RETRY_POLICY: BackupRestoreJobRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

export const DEFAULT_BACKUP_RESTORE_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const EMPTY_JOB_PROGRESS: BackupRestoreJobProgress = {
  percent: 0,
  phase: null,
  step: 0,
  stepCount: 0,
  statusMessage: null,
  updatedAt: null,
};
