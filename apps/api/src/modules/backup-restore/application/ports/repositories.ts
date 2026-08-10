/**
 * Phase 43a — repository ports only. No persistence implementations.
 */
import type { BackupJob } from '../../domain/backup-job.types';
import type { BackupSnapshot } from '../../domain/backup-snapshot.types';
import type { RestoreJob } from '../../domain/restore-job.types';
import type { BackupPolicy } from '../../domain/backup-policy.types';
import type { RetentionPolicy } from '../../domain/retention-policy.types';
import type { BackupTarget } from '../../domain/backup-target.types';
import type { RestoreRequest } from '../../domain/restore-request.types';
import type { BackupVerification } from '../../domain/backup-verification.types';
import type { RecoveryPoint } from '../../domain/recovery-point.types';

export const BACKUP_JOB_REPOSITORY = Symbol('BACKUP_JOB_REPOSITORY');
export const SNAPSHOT_REPOSITORY = Symbol('SNAPSHOT_REPOSITORY');
export const RESTORE_JOB_REPOSITORY = Symbol('RESTORE_JOB_REPOSITORY');
export const POLICY_REPOSITORY = Symbol('POLICY_REPOSITORY');
export const RETENTION_POLICY_REPOSITORY = Symbol('RETENTION_POLICY_REPOSITORY');
export const TARGET_REPOSITORY = Symbol('TARGET_REPOSITORY');
export const RESTORE_REQUEST_REPOSITORY = Symbol('RESTORE_REQUEST_REPOSITORY');
export const VERIFICATION_REPOSITORY = Symbol('VERIFICATION_REPOSITORY');
export const RECOVERY_POINT_REPOSITORY = Symbol('RECOVERY_POINT_REPOSITORY');

export interface BackupJobRepository {
  findById(id: string): Promise<BackupJob | null>;
  listByTenant(tenantId: string): Promise<readonly BackupJob[]>;
}

export interface SnapshotRepository {
  findById(id: string): Promise<BackupSnapshot | null>;
  listByTenant(tenantId: string): Promise<readonly BackupSnapshot[]>;
}

export interface RestoreJobRepository {
  findById(id: string): Promise<RestoreJob | null>;
  listByTenant(tenantId: string): Promise<readonly RestoreJob[]>;
}

export interface PolicyRepository {
  findById(id: string): Promise<BackupPolicy | null>;
  listByTenant(tenantId: string): Promise<readonly BackupPolicy[]>;
}

export interface RetentionPolicyRepository {
  findById(id: string): Promise<RetentionPolicy | null>;
  listByTenant(tenantId: string): Promise<readonly RetentionPolicy[]>;
}

export interface TargetRepository {
  findById(id: string): Promise<BackupTarget | null>;
  listByTenant(tenantId: string): Promise<readonly BackupTarget[]>;
}

export interface RestoreRequestRepository {
  findById(id: string): Promise<RestoreRequest | null>;
  listByTenant(tenantId: string): Promise<readonly RestoreRequest[]>;
}

export interface VerificationRepository {
  findById(id: string): Promise<BackupVerification | null>;
  listBySnapshot(snapshotId: string): Promise<readonly BackupVerification[]>;
}

export interface RecoveryPointRepository {
  findById(id: string): Promise<RecoveryPoint | null>;
  listByTenant(tenantId: string): Promise<readonly RecoveryPoint[]>;
}
