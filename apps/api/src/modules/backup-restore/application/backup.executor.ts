import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { BackupService } from './ports/services';
import { BACKUP_STORAGE } from './ports/backup-storage.port';
import type { BackupStoragePort } from './ports/backup-storage.port';
import { BackupRestoreJobManager } from './backup-restore-job.manager';
import { CatalogBackupTargetResolver, BackupPolicyLoader } from './backup-target-policy.resolvers';
import { BackupDataCollector } from './backup-data.collector';
import { BackupSnapshotBuilder } from './backup-snapshot.builder';
import {
  EnvelopeEncryptionOrchestrator,
  EncryptionConfigurationError,
  GzipCompressionOrchestrator,
  sha256Hex,
} from './backup-compression-encryption.orchestrators';
import {
  BACKUP_PIPELINE_STAGES,
  type BackupPipelineStage,
  type BackupSnapshotRecord,
  type BackupVerificationRequest,
} from '../domain/backup/backup-engine.types';
import type { BackupRestoreFailureClass } from '../domain/job/backup-restore-job.types';
import { BackupRestoreActivityEmitterService } from './backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './backup-restore-notification-intent.registrar';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import {
  BACKUP_SNAPSHOT_STORE,
  BACKUP_VERIFICATION_REQUEST_STORE,
  type BackupSnapshotStore,
  type BackupVerificationRequestStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import { BackupEngineObservabilityHooks } from './backup-engine-observability.hooks';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';
import { isBackupRestoreCenterEnabled } from '../config/backup-restore-config';

export interface ExecuteBackupInput {
  tenantId: string;
  jobId: string;
  leaseOwner: string;
}

export interface ExecuteBackupResult {
  jobId: string;
  snapshot: BackupSnapshotRecord;
  verificationRequest: BackupVerificationRequest | null;
  stagesCompleted: readonly BackupPipelineStage[];
  durationMs: number;
}

const STAGE_PERCENT: Record<BackupPipelineStage, number> = {
  validate_job: 5,
  load_policy: 10,
  resolve_target: 15,
  prepare_snapshot: 20,
  collect_data: 35,
  compress: 50,
  encrypt: 65,
  write_backup: 75,
  generate_manifest: 82,
  register_snapshot: 90,
  queue_verification_request: 95,
  finalize_job: 100,
};

/**
 * Phase 43c — Backup Executor.
 * Runs deterministic backup pipeline. No restore / verify execution / workers.
 */
@Injectable()
export class BackupExecutor implements BackupService {
  readonly contractVersion = '43c' as const;
  private readonly logger = new Logger(BackupExecutor.name);

  constructor(
    private readonly jobs: BackupRestoreJobManager,
    private readonly targets: CatalogBackupTargetResolver,
    private readonly policies: BackupPolicyLoader,
    private readonly collector: BackupDataCollector,
    private readonly snapshotBuilder: BackupSnapshotBuilder,
    private readonly compression: GzipCompressionOrchestrator,
    private readonly encryption: EnvelopeEncryptionOrchestrator,
    @Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshotStore: BackupSnapshotStore,
    @Inject(BACKUP_VERIFICATION_REQUEST_STORE)
    private readonly verificationRequests: BackupVerificationRequestStore,
    private readonly activity: BackupRestoreActivityEmitterService,
    private readonly audit: BackupRestoreAuditLog,
    private readonly notifications: BackupRestoreNotificationIntentRegistrar,
    private readonly observability: BackupEngineObservabilityHooks,
  ) {}

  async executeBackup(input: ExecuteBackupInput): Promise<ExecuteBackupResult> {
    if (!isBackupRestoreCenterEnabled()) {
      throw new BadRequestException('BACKUP_RESTORE_CENTER_ENABLED=false');
    }

    const started = Date.now();
    const stagesCompleted: BackupPipelineStage[] = [];
    let job = await this.jobs.getJob(input.tenantId, input.jobId, {
      userId: 'system',
      roles: ['system', 'owner'],
    });

    if (job.kind !== 'backup') {
      throw new BadRequestException('BackupExecutor only accepts kind=backup jobs');
    }

    try {
      // Validate before lease; progress updates require an active job.
      if (job.status === 'created') {
        job = await this.jobs.markQueued(job.tenantId, job.id, {
          userId: job.initiatedByUserId,
          roles: ['owner'],
        });
      }
      job = await this.jobs.startJob(job.tenantId, job.id, input.leaseOwner);

      await this.markStage(job.tenantId, job.id, 'validate_job', stagesCompleted);

      await this.activity.emit('backup_started', {
        tenantId: job.tenantId,
        branchId: job.branchId,
        jobId: job.id,
        kind: job.kind,
        typeId: job.typeId,
        status: job.status,
        correlationId: job.correlationId,
      });
      await this.notifications.registerIntent('backup_started', job);
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.backup.started',
        jobId: job.id,
        actorId: job.initiatedByUserId,
        actorRoles: ['owner'],
        correlationId: job.correlationId,
      });

      await this.markStage(job.tenantId, job.id, 'load_policy', stagesCompleted);
      const policy = this.policies.load(job);

      await this.markStage(job.tenantId, job.id, 'resolve_target', stagesCompleted);
      const target = this.targets.resolve(job);

      await this.markStage(job.tenantId, job.id, 'prepare_snapshot', stagesCompleted);
      const snapshotId = this.snapshotBuilder.newSnapshotId();
      const recoveryPointId = this.snapshotBuilder.newRecoveryPointId();

      await this.markStage(job.tenantId, job.id, 'collect_data', stagesCompleted);
      const payload = this.collector.collect(job, target);
      const rawBody = Buffer.from(JSON.stringify(payload), 'utf8');

      await this.markStage(job.tenantId, job.id, 'compress', stagesCompleted);
      const compressed = this.compression.compress(rawBody);

      await this.markStage(job.tenantId, job.id, 'encrypt', stagesCompleted);
      const encrypted = this.encryption.encrypt(compressed.body, policy.encryptionClass);

      await this.markStage(job.tenantId, job.id, 'write_backup', stagesCompleted);
      const storageKey = ['tenants', job.tenantId, 'backups', job.id, `${snapshotId}.bak`].join(
        '/',
      );
      await this.storage.put({
        storageKey,
        body: encrypted.body,
        contentType: 'application/octet-stream',
        metadata: {
          correlationId: job.correlationId,
          typeId: job.typeId,
        },
      });
      const checksum = sha256Hex(encrypted.body);

      await this.markStage(job.tenantId, job.id, 'generate_manifest', stagesCompleted);
      const manifest = this.snapshotBuilder.buildManifest({
        job,
        snapshotId,
        payload,
        compression: compressed,
        encryption: encrypted,
      });

      await this.markStage(job.tenantId, job.id, 'register_snapshot', stagesCompleted);
      const snapshot = this.snapshotBuilder.buildSnapshot({
        job,
        target,
        policy,
        manifest,
        storageKey,
        storageProvider: this.storage.providerKind,
        checksumSha256: checksum,
        sizeBytes: encrypted.body.byteLength,
        compression: compressed,
        encryption: encrypted,
        recoveryPointId,
      });
      await this.snapshotStore.save(snapshot);

      await this.activity.emit('backup_completed', {
        tenantId: job.tenantId,
        jobId: job.id,
        kind: job.kind,
        typeId: job.typeId,
        status: 'completed',
        correlationId: job.correlationId,
      });
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.backup.completed',
        jobId: job.id,
        actorId: job.initiatedByUserId,
        actorRoles: ['owner'],
        correlationId: job.correlationId,
        details: {
          snapshotId: snapshot.id,
          storageKey: snapshot.storageKey,
          checksum: snapshot.checksumSha256,
        },
      });
      await this.notifications.registerIntent('snapshot_registered', job);

      let verificationRequest: BackupVerificationRequest | null = null;
      await this.markStage(job.tenantId, job.id, 'queue_verification_request', stagesCompleted);
      if (policy.verifyAfterBackup) {
        verificationRequest = await this.verificationRequests.save({
          id: randomUUID(),
          tenantId: job.tenantId,
          branchId: job.branchId,
          snapshotId: snapshot.id,
          backupJobId: job.id,
          status: 'pending',
          checksumExpected: checksum,
          createdAt: new Date(),
          details: { queuedOnly: true, engine: '43d' },
        });
        await this.activity.emit('verification_started', {
          tenantId: job.tenantId,
          jobId: job.id,
          correlationId: job.correlationId,
          reason: 'verification_request_queued',
        });
        await this.audit.record({
          tenantId: job.tenantId,
          branchId: job.branchId,
          action: 'backupRestore.verification.requested',
          jobId: job.id,
          actorId: 'system',
          actorRoles: ['system'],
          correlationId: job.correlationId,
          details: { snapshotId: snapshot.id, requestId: verificationRequest.id },
        });
        await this.notifications.registerIntent('verification_requested', job);
      }

      await this.markStage(job.tenantId, job.id, 'finalize_job', stagesCompleted);
      await this.jobs.markCompleted(job.tenantId, job.id, {
        withVerification: policy.verifyAfterBackup,
      });

      const durationMs = Date.now() - started;
      this.observability.onBackupCompleted({
        correlationId: job.correlationId,
        durationMs,
        sizeBytes: snapshot.sizeBytes,
        compressionIn: compressed.inputBytes,
        compressionOut: compressed.outputBytes,
      });

      this.logger.log({
        kind: BACKUP_RESTORE_LOG_KIND,
        component: 'backup_executor',
        event: 'pipeline_complete',
        jobId: job.id,
        snapshotId: snapshot.id,
        stages: stagesCompleted,
        durationMs,
        correlationId: job.correlationId,
      });

      return {
        jobId: job.id,
        snapshot,
        verificationRequest,
        stagesCompleted: [...BACKUP_PIPELINE_STAGES],
        durationMs,
      };
    } catch (error) {
      const failure = mapBackupFailure(error);
      this.observability.onBackupFailed(job.correlationId, failure.failureClass);
      await this.activity.emit('backup_failed', {
        tenantId: job.tenantId,
        jobId: job.id,
        correlationId: job.correlationId,
        reason: failure.message,
      });
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'backupRestore.backup.failed',
        jobId: job.id,
        actorId: 'system',
        actorRoles: ['system'],
        correlationId: job.correlationId,
        reason: failure.message,
        details: { failureClass: failure.failureClass },
      });
      await this.notifications.registerIntent('backup_failed', job);
      try {
        await this.jobs.markFailed(job.tenantId, job.id, failure.failureClass, failure.message, {
          autoRetry: false,
        });
      } catch {
        // Job may already be terminal; do not mask original error.
      }
      throw error;
    }
  }

  private async markStage(
    tenantId: string,
    jobId: string,
    stage: BackupPipelineStage,
    stagesCompleted: BackupPipelineStage[],
  ): Promise<void> {
    stagesCompleted.push(stage);
    const index = BACKUP_PIPELINE_STAGES.indexOf(stage);
    const elapsedHint = `${stage}`;
    await this.jobs.updateProgress(tenantId, jobId, {
      percent: STAGE_PERCENT[stage],
      phase: stage,
      step: index + 1,
      stepCount: BACKUP_PIPELINE_STAGES.length,
      statusMessage: `Backup pipeline: ${stage}`,
    });
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'backup_executor',
      event: 'stage',
      stage,
      jobId,
      elapsedHint,
    });
  }
}

function mapBackupFailure(error: unknown): {
  failureClass: BackupRestoreFailureClass;
  message: string;
} {
  const message = error instanceof Error ? error.message : 'unknown_backup_failure';
  if (error instanceof EncryptionConfigurationError) {
    return { failureClass: 'ConfigurationFailure', message };
  }
  if (error instanceof BadRequestException) {
    return { failureClass: 'ValidationFailure', message };
  }
  if (message.toLowerCase().includes('storage')) {
    return { failureClass: 'StorageFailure', message };
  }
  if (message.toLowerCase().includes('compress')) {
    return { failureClass: 'SystemFailure', message };
  }
  return { failureClass: 'SystemFailure', message };
}
