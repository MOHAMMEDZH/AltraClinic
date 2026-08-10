import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { RestoreService } from './ports/services';
import { BACKUP_STORAGE } from './ports/backup-storage.port';
import type { BackupStoragePort } from './ports/backup-storage.port';
import { BackupRestoreJobManager } from './backup-restore-job.manager';
import {
  EnvelopeEncryptionOrchestrator,
  EncryptionConfigurationError,
  GzipCompressionOrchestrator,
  sha256Hex,
} from './backup-compression-encryption.orchestrators';
import {
  RESTORE_PIPELINE_STAGES,
  type RestorePipelineStage,
  type RestoreResultRecord,
  type RestoredObjectSummary,
  type RestoreValidationResult,
  type ResolvedRecoveryPoint,
  type ResolvedRestoreTarget,
} from '../domain/restore/restore-engine.types';
import type { BackupRestoreFailureClass } from '../domain/job/backup-restore-job.types';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';
import { BackupRestoreActivityEmitterService } from './backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './backup-restore-notification-intent.registrar';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import {
  BACKUP_SNAPSHOT_STORE,
  type BackupSnapshotStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import {
  RESTORE_RESULT_STORE,
  RESTORE_SCRATCH_STORE,
  type RestoreResultStore,
  type RestoreScratchStore,
} from '../infrastructure/in-memory-restore-result.store';
import { RestoreTargetResolver } from './restore-target.resolver';
import { RestoreRecoveryPointResolver } from './restore-recovery-point.resolver';
import { RestoreValidator } from './restore-validator';
import { RestoreEngineObservabilityHooks } from './restore-engine-observability.hooks';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';
import {
  isBackupRestoreCenterEnabled,
  loadBackupRestoreFoundationConfig,
} from '../config/backup-restore-config';

export interface ExecuteRestoreInput {
  tenantId: string;
  jobId: string;
  leaseOwner: string;
  /** When false, license/permission preflight fails. Defaults true for system/tests. */
  allowBackupRestore?: boolean;
  hasManagePermission?: boolean;
}

export interface ExecuteRestoreResult {
  jobId: string;
  result: RestoreResultRecord;
  stagesCompleted: readonly RestorePipelineStage[];
  durationMs: number;
}

const STAGE_PERCENT: Record<RestorePipelineStage, number> = {
  validate_restore_request: 5,
  load_snapshot: 12,
  validate_verification_status: 20,
  resolve_recovery_point: 28,
  load_manifest: 36,
  validate_restore_target: 44,
  prepare_restore: 52,
  restore_data: 72,
  validate_restore: 84,
  finalize_restore: 94,
  complete_job: 100,
};

/**
 * Phase 43e — Restore Executor.
 * Restores from VERIFIED snapshots only into logical scratch targets.
 * No backup / verify / retention / cleanup / workers.
 */
@Injectable()
export class RestoreExecutor implements RestoreService {
  readonly contractVersion = '43e' as const;
  private readonly logger = new Logger(RestoreExecutor.name);

  constructor(
    private readonly jobs: BackupRestoreJobManager,
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshots: BackupSnapshotStore,
    @Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
    @Inject(RESTORE_RESULT_STORE) private readonly results: RestoreResultStore,
    @Inject(RESTORE_SCRATCH_STORE) private readonly scratch: RestoreScratchStore,
    private readonly compression: GzipCompressionOrchestrator,
    private readonly encryption: EnvelopeEncryptionOrchestrator,
    private readonly targets: RestoreTargetResolver,
    private readonly recoveryPoints: RestoreRecoveryPointResolver,
    private readonly validator: RestoreValidator,
    private readonly activity: BackupRestoreActivityEmitterService,
    private readonly audit: BackupRestoreAuditLog,
    private readonly notifications: BackupRestoreNotificationIntentRegistrar,
    private readonly observability: RestoreEngineObservabilityHooks,
  ) {}

  async executeRestore(input: ExecuteRestoreInput): Promise<ExecuteRestoreResult> {
    if (!isBackupRestoreCenterEnabled()) {
      throw new BadRequestException('BACKUP_RESTORE_CENTER_ENABLED=false');
    }

    const started = Date.now();
    const stagesCompleted: RestorePipelineStage[] = [];
    const restoreId = randomUUID();
    const warnings: string[] = [];
    let snapshot: BackupSnapshotRecord | null = null;
    let recoveryPoint: ResolvedRecoveryPoint | null = null;
    let target: ResolvedRestoreTarget | null = null;
    let validation: RestoreValidationResult | null = null;
    let objectsRestored = 0;
    let bytesRestored = 0;
    let restoredObjects: RestoredObjectSummary[] = [];

    let job = await this.jobs.getJob(input.tenantId, input.jobId, {
      userId: 'system',
      roles: ['system', 'owner'],
    });

    if (job.kind !== 'restore') {
      throw new BadRequestException('RestoreExecutor only accepts kind=restore jobs');
    }

    const restoreMode =
      job.metadata.restoreMode === 'controlled' ? 'controlled' : 'drill';

    try {
      if (job.status === 'created') {
        job = await this.jobs.markQueued(job.tenantId, job.id, {
          userId: job.initiatedByUserId,
          roles: ['owner'],
        });
      }
      job = await this.jobs.startJob(job.tenantId, job.id, input.leaseOwner);

      await this.markStage(job.tenantId, job.id, 'validate_restore_request', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });

      await this.activity.emit('restore_started', {
        tenantId: job.tenantId,
        branchId: job.branchId,
        jobId: job.id,
        kind: job.kind,
        typeId: job.typeId,
        status: job.status,
        correlationId: job.correlationId,
        reason: restoreMode,
      });
      await this.notifications.registerIntent('restore_started', job);
      if (restoreMode === 'drill') {
        await this.activity.emit('drill_started', {
          tenantId: job.tenantId,
          jobId: job.id,
          correlationId: job.correlationId,
        });
      }
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.restore.requested',
        jobId: job.id,
        actorId: job.initiatedByUserId,
        actorRoles: ['owner'],
        correlationId: job.correlationId,
        details: { restoreMode, restoreId },
      });

      await this.markStage(job.tenantId, job.id, 'load_snapshot', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });

      const resolved = await this.recoveryPoints.resolve(job);
      snapshot = resolved.snapshot;

      await this.markStage(
        job.tenantId,
        job.id,
        'validate_verification_status',
        stagesCompleted,
        { objectsRestored: 0, bytesRestored: 0 },
      );
      if (snapshot.verificationStatus !== 'passed') {
        throw new BadRequestException(
          `Only VERIFIED snapshots may be restored (status=${snapshot.verificationStatus})`,
        );
      }

      await this.markStage(job.tenantId, job.id, 'resolve_recovery_point', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });
      recoveryPoint = resolved.recoveryPoint;
      this.observability.onRecoveryPointSelected(job.correlationId, snapshot.id);
      await this.activity.emit('recovery_point_selected', {
        tenantId: job.tenantId,
        jobId: job.id,
        correlationId: job.correlationId,
        reason: recoveryPoint.selectionMode,
      });
      await this.notifications.registerIntent('recovery_point_selected', job);
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.restore.recovery_point_selected',
        jobId: job.id,
        actorId: job.initiatedByUserId,
        actorRoles: ['owner'],
        correlationId: job.correlationId,
        details: {
          snapshotId: snapshot.id,
          recoveryPointId: recoveryPoint.recoveryPointId ?? '',
          selectionMode: recoveryPoint.selectionMode,
        },
      });

      await this.markStage(job.tenantId, job.id, 'load_manifest', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });
      if (!snapshot.manifest) {
        throw new BadRequestException('Snapshot manifest missing');
      }

      await this.markStage(job.tenantId, job.id, 'validate_restore_target', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });
      target = this.targets.resolve(job, restoreMode);

      const allowBackupRestore = input.allowBackupRestore ?? true;
      const hasManagePermission = input.hasManagePermission ?? true;
      validation = await this.validator.validate({
        job,
        snapshot,
        storage: this.storage,
        allowBackupRestore,
        hasManagePermission,
      });
      await this.activity.emit('restore_validated', {
        tenantId: job.tenantId,
        jobId: job.id,
        correlationId: job.correlationId,
        reason: validation.valid ? 'ok' : validation.reasons.join('; '),
      });
      if (!validation.valid) {
        this.observability.onValidationFailed(
          job.correlationId,
          validation.reasons.join('; '),
        );
        await this.notifications.registerIntent('restore_validation_failed', job);
        throw new BadRequestException(
          `Restore validation failed: ${validation.reasons.join('; ')}`,
        );
      }

      await this.markStage(job.tenantId, job.id, 'prepare_restore', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: 0,
      });

      const stored = await this.storage.get(snapshot.storageKey);
      if (!stored) {
        throw new BadRequestException('StorageFailure: restore artifact not found');
      }
      const checksum = sha256Hex(stored);
      if (checksum.toLowerCase() !== snapshot.checksumSha256.toLowerCase()) {
        throw new BadRequestException(
          'VerificationFailure: stored artifact checksum mismatch',
        );
      }

      await this.markStage(job.tenantId, job.id, 'restore_data', stagesCompleted, {
        objectsRestored: 0,
        bytesRestored: stored.byteLength,
      });

      const decrypted =
        snapshot.encryptionClass === 'none'
          ? stored
          : this.encryption.decrypt(stored);
      const decompressed =
        snapshot.compression === 'none'
          ? decrypted
          : this.compression.decompress(decrypted);

      let payload: {
        schemaVersion?: string;
        logicalData?: Record<string, unknown>;
        resources?: Array<{
          resourceType: string;
          resourceId: string;
          entityCount: number;
        }>;
      };
      try {
        payload = JSON.parse(decompressed.toString('utf8')) as typeof payload;
      } catch {
        throw new BadRequestException('Restore payload JSON parse failed');
      }

      const logicalData = payload.logicalData ?? {};
      const entityCounts: Record<string, number> = {};
      restoredObjects = (payload.resources ?? snapshot.manifest.resources).map((r) => {
        entityCounts[r.resourceType] =
          (entityCounts[r.resourceType] ?? 0) + (r.entityCount ?? 0);
        return {
          resourceType: r.resourceType,
          resourceId: r.resourceId,
          entityCount: r.entityCount ?? 0,
        };
      });
      objectsRestored = restoredObjects.reduce((n, o) => n + o.entityCount, 0);
      bytesRestored = decompressed.byteLength;

      await this.scratch.save({
        restoreId,
        tenantId: job.tenantId,
        destinationKey: target.destinationKey,
        payloadSchemaVersion: payload.schemaVersion ?? null,
        logicalDataKeys: Object.keys(logicalData),
        entityCounts,
        restoredAt: new Date(),
      });

      await this.markStage(job.tenantId, job.id, 'validate_restore', stagesCompleted, {
        objectsRestored,
        bytesRestored,
      });
      const scratchRow = await this.scratch.findByRestoreId(job.tenantId, restoreId);
      if (!scratchRow || scratchRow.logicalDataKeys.length === 0) {
        warnings.push('Logical restore scratch has no data keys');
      }
      if (objectsRestored === 0) {
        warnings.push('Zero entities restored from snapshot resources');
      }

      await this.markStage(job.tenantId, job.id, 'finalize_restore', stagesCompleted, {
        objectsRestored,
        bytesRestored,
      });

      const durationMs = Date.now() - started;
      const result: RestoreResultRecord = {
        id: restoreId,
        tenantId: job.tenantId,
        branchId: job.branchId,
        jobId: job.id,
        snapshotId: snapshot.id,
        recoveryPointId: recoveryPoint.recoveryPointId,
        restoreMode,
        target,
        status: 'completed',
        stagesCompleted: [...RESTORE_PIPELINE_STAGES],
        objectsRestored,
        bytesRestored,
        restoredObjects,
        warnings,
        validation,
        durationMs,
        failureReason: null,
        correlationId: job.correlationId,
        createdAt: new Date(started),
        completedAt: new Date(),
        details: {
          selectionMode: recoveryPoint.selectionMode,
          storageKey: snapshot.storageKey,
          checksum,
        },
      };
      await this.results.save(result);

      await this.activity.emit('restore_completed', {
        tenantId: job.tenantId,
        jobId: job.id,
        kind: job.kind,
        typeId: job.typeId,
        status: 'completed',
        correlationId: job.correlationId,
      });
      if (restoreMode === 'drill') {
        await this.activity.emit('drill_completed', {
          tenantId: job.tenantId,
          jobId: job.id,
          correlationId: job.correlationId,
        });
      }
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action:
          restoreMode === 'drill'
            ? 'backupRestore.drill.executed'
            : 'backupRestore.restore.executed',
        jobId: job.id,
        actorId: job.initiatedByUserId,
        actorRoles: ['owner'],
        correlationId: job.correlationId,
        details: {
          restoreId,
          snapshotId: snapshot.id,
          objectsRestored: String(objectsRestored),
          bytesRestored: String(bytesRestored),
        },
      });
      await this.notifications.registerIntent('restore_completed', job);

      await this.markStage(job.tenantId, job.id, 'complete_job', stagesCompleted, {
        objectsRestored,
        bytesRestored,
      });
      await this.jobs.markCompleted(job.tenantId, job.id);

      this.observability.onRestoreCompleted({
        correlationId: job.correlationId,
        durationMs,
        bytesRestored,
      });

      this.logger.log({
        kind: BACKUP_RESTORE_LOG_KIND,
        component: 'restore_executor',
        event: 'pipeline_complete',
        jobId: job.id,
        restoreId,
        snapshotId: snapshot.id,
        stages: stagesCompleted,
        durationMs,
        correlationId: job.correlationId,
      });

      return {
        jobId: job.id,
        result,
        stagesCompleted: [...RESTORE_PIPELINE_STAGES],
        durationMs,
      };
    } catch (error) {
      const failure = mapRestoreFailure(error);
      this.observability.onRestoreFailed(job.correlationId, failure.failureClass);

      const durationMs = Date.now() - started;
      const failedResult: RestoreResultRecord = {
        id: restoreId,
        tenantId: job.tenantId,
        branchId: job.branchId,
        jobId: job.id,
        snapshotId: snapshot?.id ?? String(job.metadata.snapshotId ?? ''),
        recoveryPointId: recoveryPoint?.recoveryPointId ?? null,
        restoreMode,
        target: target ?? {
          kind: 'temporary_validation',
          targetId: 'unresolved',
          displayName: 'unresolved',
          destinationKey: 'unresolved',
          compatible: false,
          mode: restoreMode,
        },
        status: 'failed',
        stagesCompleted: [...stagesCompleted],
        objectsRestored,
        bytesRestored,
        restoredObjects,
        warnings,
        validation: validation ?? emptyValidation(failure.message),
        durationMs,
        failureReason: failure.message,
        correlationId: job.correlationId,
        createdAt: new Date(started),
        completedAt: new Date(),
        details: { failureClass: failure.failureClass },
      };
      try {
        await this.results.save(failedResult);
      } catch {
        // Persistence failure must not mask restore failure.
      }

      await this.activity.emit('restore_failed', {
        tenantId: job.tenantId,
        jobId: job.id,
        correlationId: job.correlationId,
        reason: failure.message,
      });
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.restore.failed',
        jobId: job.id,
        actorId: 'system',
        actorRoles: ['system'],
        correlationId: job.correlationId,
        reason: failure.message,
        details: { failureClass: failure.failureClass },
      });
      await this.notifications.registerIntent('restore_failed', job);
      try {
        await this.jobs.markFailed(job.tenantId, job.id, failure.failureClass, failure.message, {
          autoRetry: false,
        });
      } catch {
        // Job may already be terminal.
      }
      throw error;
    }
  }

  private async markStage(
    tenantId: string,
    jobId: string,
    stage: RestorePipelineStage,
    stagesCompleted: RestorePipelineStage[],
    progress: { objectsRestored: number; bytesRestored: number },
  ): Promise<void> {
    stagesCompleted.push(stage);
    const index = RESTORE_PIPELINE_STAGES.indexOf(stage);
    const elapsedHint = `${stage}`;
    await this.jobs.updateProgress(tenantId, jobId, {
      percent: STAGE_PERCENT[stage],
      phase: stage,
      step: index + 1,
      stepCount: RESTORE_PIPELINE_STAGES.length,
      statusMessage: `Restore pipeline: ${stage} (objects=${progress.objectsRestored}, bytes=${progress.bytesRestored})`,
    });
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'restore_executor',
      event: 'stage',
      stage,
      jobId,
      elapsedHint,
    });
  }
}

function emptyValidation(reason: string): RestoreValidationResult {
  return {
    valid: false,
    licenseOk: false,
    permissionsOk: false,
    featureFlagsOk: false,
    tenantOwnershipOk: false,
    verificationStatusOk: false,
    manifestOk: false,
    storageAvailable: false,
    restorePolicyOk: false,
    reasons: [reason],
  };
}

function mapRestoreFailure(error: unknown): {
  failureClass: BackupRestoreFailureClass;
  message: string;
} {
  const message = error instanceof Error ? error.message : 'unknown_restore_failure';
  const lower = message.toLowerCase();
  if (error instanceof EncryptionConfigurationError) {
    return { failureClass: 'ConfigurationFailure', message };
  }
  if (lower.includes('permission') || lower.includes('license')) {
    return {
      failureClass: lower.includes('license') ? 'LicenseFailure' : 'PermissionFailure',
      message,
    };
  }
  if (lower.includes('verificationfailure') || lower.includes('checksum')) {
    return { failureClass: 'VerificationFailure', message };
  }
  if (lower.includes('storage')) {
    return { failureClass: 'StorageFailure', message };
  }
  if (error instanceof BadRequestException) {
    return { failureClass: 'ValidationFailure', message };
  }
  return { failureClass: 'SystemFailure', message };
}

/** Expose config helper for tests without redesign. */
export function restoreDualControlRequired(): boolean {
  return loadBackupRestoreFoundationConfig().defaults.dualControlRestore;
}
