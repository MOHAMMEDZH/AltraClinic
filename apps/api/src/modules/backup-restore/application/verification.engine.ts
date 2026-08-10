import { randomUUID } from 'crypto';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { VerificationService } from './ports/services';
import { BACKUP_STORAGE } from './ports/backup-storage.port';
import type { BackupStoragePort } from './ports/backup-storage.port';
import {
  BACKUP_SNAPSHOT_STORE,
  BACKUP_VERIFICATION_REQUEST_STORE,
  type BackupSnapshotStore,
  type BackupVerificationRequestStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import {
  VERIFICATION_RESULT_STORE,
  type VerificationResultStore,
} from '../infrastructure/verification-retention.stores';
import { BackupManifestValidator } from './backup-manifest.validator';
import { sha256Hex } from './backup-compression-encryption.orchestrators';
import {
  VERIFICATION_PIPELINE_STAGES,
  type VerificationLifecycleStatus,
  type VerificationPipelineStage,
  type VerificationResultRecord,
  type VerificationTransitionRecord,
} from '../domain/verification/verification-retention.types';
import { assertVerificationTransition } from '../domain/verification/verification-state-machine';
import { BackupRestoreActivityEmitterService } from './backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './backup-restore-notification-intent.registrar';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { VerificationRetentionObservabilityHooks } from './verification-retention-observability.hooks';
import { BACKUP_RESTORE_LOG_KIND } from '../backup-restore.constants';
import { isBackupRestoreCenterEnabled } from '../config/backup-restore-config';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';

export interface ExecuteVerificationInput {
  tenantId: string;
  snapshotId: string;
  requestId?: string | null;
  actorId?: string;
  correlationId?: string;
}

/**
 * Phase 43d — Verification Engine.
 * Verifies integrity only. No restore / cleanup / workers.
 */
@Injectable()
export class VerificationEngine implements VerificationService {
  readonly contractVersion = '43d' as const;
  private readonly logger = new Logger(VerificationEngine.name);

  constructor(
    @Inject(BACKUP_SNAPSHOT_STORE) private readonly snapshots: BackupSnapshotStore,
    @Inject(BACKUP_VERIFICATION_REQUEST_STORE)
    private readonly requests: BackupVerificationRequestStore,
    @Inject(VERIFICATION_RESULT_STORE) private readonly results: VerificationResultStore,
    @Inject(BACKUP_STORAGE) private readonly storage: BackupStoragePort,
    private readonly validator: BackupManifestValidator,
    private readonly activity: BackupRestoreActivityEmitterService,
    private readonly audit: BackupRestoreAuditLog,
    private readonly notifications: BackupRestoreNotificationIntentRegistrar,
    private readonly observability: VerificationRetentionObservabilityHooks,
  ) {}

  async verify(input: ExecuteVerificationInput): Promise<VerificationResultRecord> {
    if (!isBackupRestoreCenterEnabled()) {
      throw new BadRequestException('BACKUP_RESTORE_CENTER_ENABLED=false');
    }

    const started = Date.now();
    const actorId = input.actorId ?? 'system';
    const correlationId = input.correlationId?.trim() || randomUUID();
    const stagesCompleted: VerificationPipelineStage[] = [];
    const transitions: VerificationTransitionRecord[] = [];
    let status: VerificationLifecycleStatus = 'pending';
    const resultId = randomUUID();
    const now = new Date();

    const transitionTo = (to: VerificationLifecycleStatus, reason?: string) => {
      assertVerificationTransition(status, to);
      transitions.push({
        from: status,
        to,
        at: new Date(),
        actorId,
        reason: reason ?? null,
      });
      status = to;
    };

    await this.activity.emit('verification_started', {
      tenantId: input.tenantId,
      jobId: input.snapshotId,
      correlationId,
      reason: 'verification_engine',
    });
    await this.audit.record({
      tenantId: input.tenantId,
      action: 'backupRestore.verification.started',
      jobId: input.snapshotId,
      actorId,
      actorRoles: ['system'],
      correlationId,
      details: { snapshotId: input.snapshotId },
    });

    stagesCompleted.push('load_snapshot');
    const snapshot = await this.snapshots.findById(input.tenantId, input.snapshotId);
    if (!snapshot) {
      throw new NotFoundException(`Snapshot not found: ${input.snapshotId}`);
    }

    transitionTo('running', 'pipeline_start');
    if (input.requestId) {
      await this.patchRequest(input.tenantId, input.requestId, 'running', resultId);
    }

    stagesCompleted.push('load_manifest');

    stagesCompleted.push('validate_metadata');
    if (!snapshot.checksumSha256 || !snapshot.storageKey) {
      transitionTo('verification_failed', 'metadata_invalid');
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: 'Snapshot metadata incomplete',
        checksumActual: null,
        success: false,
      });
    }

    stagesCompleted.push('validate_storage_reference');
    if (!(await this.storage.exists(snapshot.storageKey))) {
      transitionTo('corrupted', 'storage_missing');
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: 'Storage reference missing',
        checksumActual: null,
        success: false,
        corrupted: true,
      });
    }

    stagesCompleted.push('verify_checksum');
    const body = await this.storage.get(snapshot.storageKey);
    if (!body) {
      transitionTo('corrupted', 'storage_unreadable');
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: 'Storage object unreadable',
        checksumActual: null,
        success: false,
        corrupted: true,
      });
    }
    const checksumActual = sha256Hex(body);
    const checksumIssue = this.validator.validateChecksum(snapshot.checksumSha256, checksumActual);
    if (checksumIssue) {
      transitionTo('corrupted', checksumIssue.code);
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: checksumIssue.message,
        checksumActual,
        success: false,
        corrupted: true,
      });
    }

    stagesCompleted.push('verify_compression_metadata');
    const compressionIssues = this.validator.validateCompressionMetadata(
      snapshot.manifest,
      snapshot,
    );
    if (compressionIssues.length) {
      transitionTo('verification_failed', compressionIssues[0].code);
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: compressionIssues[0].message,
        checksumActual,
        success: false,
      });
    }

    stagesCompleted.push('verify_encryption_metadata');
    const encryptionIssues = this.validator.validateEncryptionMetadata(
      snapshot.manifest,
      snapshot,
    );
    if (encryptionIssues.length) {
      transitionTo('verification_failed', encryptionIssues[0].code);
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: encryptionIssues[0].message,
        checksumActual,
        success: false,
      });
    }

    stagesCompleted.push('validate_manifest');
    const manifestResult = this.validator.validate(snapshot, input.tenantId);
    if (!manifestResult.valid) {
      transitionTo('verification_failed', manifestResult.issues[0]?.code ?? 'manifest_invalid');
      return this.persistOutcome({
        resultId,
        input,
        snapshot,
        status,
        stagesCompleted,
        transitions,
        correlationId,
        actorId,
        now,
        started,
        reason: manifestResult.issues.map((i) => i.message).join('; '),
        checksumActual,
        success: false,
      });
    }

    stagesCompleted.push('update_verification_result');
    transitionTo('verified', 'integrity_ok');
    if (this.snapshots.updateVerificationStatus) {
      await this.snapshots.updateVerificationStatus(input.tenantId, snapshot.id, 'passed');
    }
    stagesCompleted.push('complete_verification');

    const record = await this.persistOutcome({
      resultId,
      input,
      snapshot,
      status: 'verified',
      stagesCompleted: [...VERIFICATION_PIPELINE_STAGES],
      transitions,
      correlationId,
      actorId,
      now,
      started,
      reason: null,
      checksumActual,
      success: true,
    });

    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'verification_engine',
      event: 'verified',
      snapshotId: snapshot.id,
      correlationId,
    });

    return record;
  }

  private async patchRequest(
    tenantId: string,
    requestId: string,
    status: BackupVerificationRequestStatus,
    resultId: string,
  ): Promise<void> {
    const request = await this.requests.findById(tenantId, requestId);
    if (!request) return;
    await this.requests.save({
      ...request,
      status,
      details: { ...request.details, verificationResultId: resultId },
    });
  }

  private async persistOutcome(args: {
    resultId: string;
    input: ExecuteVerificationInput;
    snapshot: BackupSnapshotRecord;
    status: VerificationLifecycleStatus;
    stagesCompleted: readonly VerificationPipelineStage[];
    transitions: VerificationTransitionRecord[];
    correlationId: string;
    actorId: string;
    now: Date;
    started: number;
    reason: string | null;
    checksumActual: string | null;
    success: boolean;
    corrupted?: boolean;
  }): Promise<VerificationResultRecord> {
    const completedAt = new Date();
    const record: VerificationResultRecord = {
      id: args.resultId,
      tenantId: args.input.tenantId,
      branchId: args.snapshot.branchId,
      snapshotId: args.snapshot.id,
      backupJobId: args.snapshot.backupJobId,
      requestId: args.input.requestId ?? null,
      status: args.status,
      checksumExpected: args.snapshot.checksumSha256,
      checksumActual: args.checksumActual,
      stagesCompleted: args.stagesCompleted,
      failureReason: args.reason,
      transitions: args.transitions,
      startedAt: args.now,
      completedAt,
      correlationId: args.correlationId,
      createdAt: args.now,
      updatedAt: completedAt,
      details: {
        durationMs: Date.now() - args.started,
        corrupted: !!args.corrupted,
      },
    };
    await this.results.save(record);

    if (args.input.requestId) {
      await this.patchRequest(
        args.input.tenantId,
        args.input.requestId,
        args.corrupted ? 'corrupted' : args.success ? 'verified' : 'verification_failed',
        args.resultId,
      );
    }

    if (!args.success && this.snapshots.updateVerificationStatus) {
      await this.snapshots.updateVerificationStatus(
        args.input.tenantId,
        args.snapshot.id,
        'failed',
      );
    }

    if (args.success) {
      this.observability.onVerificationSuccess(
        args.correlationId,
        Date.now() - args.started,
      );
      await this.activity.emit('verification_completed', {
        tenantId: args.input.tenantId,
        jobId: args.snapshot.backupJobId,
        correlationId: args.correlationId,
      });
      await this.notifications.registerIntentForEntity('verification_completed', {
        id: args.resultId,
        tenantId: args.input.tenantId,
        correlationId: args.correlationId,
      });
      await this.audit.record({
        tenantId: args.input.tenantId,
        branchId: args.snapshot.branchId,
        action: 'backupRestore.verification.completed',
        jobId: args.snapshot.backupJobId,
        actorId: args.actorId,
        actorRoles: ['system'],
        correlationId: args.correlationId,
        details: { snapshotId: args.snapshot.id, status: 'verified' },
      });
    } else {
      this.observability.onVerificationFailure(
        args.correlationId,
        args.reason ?? 'verification_failed',
      );
      await this.activity.emit('verification_failed', {
        tenantId: args.input.tenantId,
        jobId: args.snapshot.backupJobId,
        correlationId: args.correlationId,
        reason: args.reason ?? undefined,
      });
      await this.notifications.registerIntentForEntity('verification_failed', {
        id: args.resultId,
        tenantId: args.input.tenantId,
        correlationId: args.correlationId,
      });
      await this.audit.record({
        tenantId: args.input.tenantId,
        branchId: args.snapshot.branchId,
        action: 'backupRestore.verification.failed',
        jobId: args.snapshot.backupJobId,
        actorId: args.actorId,
        actorRoles: ['system'],
        correlationId: args.correlationId,
        reason: args.reason,
        details: { snapshotId: args.snapshot.id, status: args.status },
      });
    }

    return record;
  }
}

type BackupVerificationRequestStatus =
  | 'pending'
  | 'running'
  | 'verified'
  | 'verification_failed'
  | 'expired'
  | 'corrupted'
  | 'unknown';
