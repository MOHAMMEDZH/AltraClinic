import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';
import type { VerificationResultRecord } from '../domain/verification/verification-retention.types';
import type { RetentionEvaluationRecord } from '../domain/verification/verification-retention.types';
import type { CleanupPlanRecord } from '../domain/verification/verification-retention.types';
import type { RestoreResultRecord } from '../domain/restore/restore-engine.types';

/** Phase 43f — public DTOs for Operations UI (no PHI payloads). */

export function toPublicBackupRestoreJob(job: BackupRestoreJob) {
  return {
    id: job.id,
    tenantId: job.tenantId,
    branchId: job.branchId,
    kind: job.kind,
    typeId: job.typeId,
    status: job.status,
    priority: job.priority,
    initiatedByUserId: job.initiatedByUserId,
    ownerUserId: job.ownerUserId,
    idempotencyKey: job.idempotencyKey,
    correlationId: job.correlationId,
    attemptCount: job.attemptCount,
    maxAttempts: job.maxAttempts,
    lastError: job.lastError,
    failureClass: job.failureClass,
    cancelReason: job.cancelReason,
    progress: {
      percent: job.progress.percent,
      phase: job.progress.phase,
      step: job.progress.step,
      stepCount: job.progress.stepCount,
      statusMessage: job.progress.statusMessage,
      updatedAt: job.progress.updatedAt?.toISOString() ?? null,
    },
    metadata: { ...job.metadata },
    leasedAt: job.leasedAt?.toISOString() ?? null,
    leaseOwner: job.leaseOwner,
    scheduledAt: job.scheduledAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    completedAt: job.completedAt?.toISOString() ?? null,
    deadLetteredAt: job.deadLetteredAt?.toISOString() ?? null,
    expiresAt: job.expiresAt?.toISOString() ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    transitionCount: job.transitions.length,
  };
}

export function toPublicBackupRestoreJobs(jobs: readonly BackupRestoreJob[]) {
  return jobs.map(toPublicBackupRestoreJob);
}

export function toPublicSnapshot(snapshot: BackupSnapshotRecord) {
  return {
    id: snapshot.id,
    backupJobId: snapshot.backupJobId,
    tenantId: snapshot.tenantId,
    branchId: snapshot.branchId,
    recoveryPointId: snapshot.recoveryPointId,
    checksumSha256: snapshot.checksumSha256,
    sizeBytes: snapshot.sizeBytes,
    encryptionClass: snapshot.encryptionClass,
    compression: snapshot.compression,
    storageKey: snapshot.storageKey,
    storageProvider: snapshot.storageProvider,
    verificationStatus: snapshot.verificationStatus,
    createdAt: snapshot.createdAt.toISOString(),
    expiresAt: snapshot.expiresAt?.toISOString() ?? null,
    manifest: {
      schemaVersion: snapshot.manifest.schemaVersion,
      typeId: snapshot.manifest.typeId,
      resourceCount: snapshot.manifest.resources.length,
      entityCounts: { ...snapshot.manifest.entityCounts },
      compression: snapshot.manifest.compression,
      encryptionClass: snapshot.manifest.encryptionClass,
      encryptionAlgorithm: snapshot.manifest.encryptionAlgorithm ?? '',
      keyReference: snapshot.manifest.keyReference ? '[redacted]' : null,
    },
  };
}

export function toPublicVerificationResult(row: VerificationResultRecord) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    snapshotId: row.snapshotId,
    requestId: row.requestId,
    status: row.status,
    stagesCompleted: [...row.stagesCompleted],
    checksumExpected: row.checksumExpected,
    checksumActual: row.checksumActual,
    failureReason: row.failureReason,
    correlationId: row.correlationId,
    startedAt: row.startedAt?.toISOString() ?? null,
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    transitionCount: row.transitions.length,
  };
}

export function toPublicRetentionEvaluation(row: RetentionEvaluationRecord) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    evaluatedAt: row.evaluatedAt.toISOString(),
    policy: { ...row.policy },
    expiredSnapshotIds: [...row.expiredSnapshotIds],
    orphanedSnapshotIds: [...row.orphanedSnapshotIds],
    retainedSnapshotIds: [...row.retainedSnapshotIds],
    legalHoldSnapshotIds: [...row.legalHoldSnapshotIds],
    correlationId: row.correlationId,
    details: { ...row.details },
  };
}

export function toPublicCleanupPlan(row: CleanupPlanRecord) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    createdAt: row.createdAt.toISOString(),
    priority: row.priority,
    estimatedReclaimedBytes: row.estimatedReclaimedBytes,
    executed: row.executed,
    itemCount: row.items.length,
    items: row.items.map((i) => ({
      snapshotId: i.snapshotId,
      reason: i.reason,
      estimatedBytes: i.sizeBytes,
    })),
    correlationId: row.correlationId,
  };
}

export function toPublicRestoreResult(row: RestoreResultRecord) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    jobId: row.jobId,
    snapshotId: row.snapshotId,
    recoveryPointId: row.recoveryPointId,
    restoreMode: row.restoreMode,
    target: { ...row.target },
    status: row.status,
    objectsRestored: row.objectsRestored,
    bytesRestored: row.bytesRestored,
    warnings: [...row.warnings],
    validation: {
      valid: row.validation.valid,
      reasons: [...row.validation.reasons],
    },
    durationMs: row.durationMs,
    failureReason: row.failureReason,
    correlationId: row.correlationId,
    createdAt: row.createdAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export function toPublicRecoveryPoint(snapshot: BackupSnapshotRecord) {
  return {
    id: snapshot.recoveryPointId ?? snapshot.id,
    snapshotId: snapshot.id,
    label: snapshot.recoveryPointId ? 'recovery_point' : 'snapshot',
    capturedAt: snapshot.createdAt.toISOString(),
    verified: snapshot.verificationStatus === 'passed',
    verificationStatus: snapshot.verificationStatus,
    expiresAt: snapshot.expiresAt?.toISOString() ?? null,
    restoreAvailable: snapshot.verificationStatus === 'passed',
    sizeBytes: snapshot.sizeBytes,
    typeId: snapshot.manifest.typeId,
  };
}
