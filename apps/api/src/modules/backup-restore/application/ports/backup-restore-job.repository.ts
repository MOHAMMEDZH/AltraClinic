import type {
  BackupRestoreDeadLetterRecord,
  BackupRestoreJob,
  BackupRestoreJobKind,
  BackupRestoreJobStatus,
} from '../../domain/job/backup-restore-job.types';

export const BACKUP_RESTORE_JOB_REPOSITORY = Symbol('BACKUP_RESTORE_JOB_REPOSITORY');

export interface CreateBackupRestoreJobRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  kind: BackupRestoreJobKind;
  typeId: string;
  status: BackupRestoreJobStatus;
  priority: string;
  initiatedByUserId: string;
  ownerUserId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
  scheduledAt: Date | null;
}

export interface ListBackupRestoreJobsFilter {
  tenantId: string;
  branchId?: string | null;
  status?: BackupRestoreJobStatus;
  kind?: BackupRestoreJobKind;
  typeId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Phase 43b — job metadata repository port.
 * No backup payload / artifact bytes.
 */
export interface BackupRestoreJobRepository {
  create(job: CreateBackupRestoreJobRecord): Promise<BackupRestoreJob>;
  update(job: BackupRestoreJob): Promise<BackupRestoreJob>;
  findById(tenantId: string, jobId: string): Promise<BackupRestoreJob | null>;
  findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<BackupRestoreJob | null>;
  list(filter: ListBackupRestoreJobsFilter): Promise<BackupRestoreJob[]>;
  countByStatus(tenantId?: string): Promise<Partial<Record<BackupRestoreJobStatus, number>>>;
  saveDeadLetter(
    record: Omit<BackupRestoreDeadLetterRecord, 'createdAt'> & { createdAt?: Date },
  ): Promise<BackupRestoreDeadLetterRecord>;
  listDeadLetters(tenantId: string, limit?: number): Promise<BackupRestoreDeadLetterRecord[]>;
  findExpiredCandidates(now: Date, limit?: number): Promise<BackupRestoreJob[]>;
  /** Active jobs holding a logical lease for the same kind+target (duplicate guard). */
  findActiveByKindTarget(
    tenantId: string,
    kind: BackupRestoreJobKind,
    targetKey: string,
  ): Promise<BackupRestoreJob[]>;
}
