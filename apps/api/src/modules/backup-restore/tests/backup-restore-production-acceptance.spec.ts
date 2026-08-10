import { randomBytes } from 'crypto';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupExecutor } from '../application/backup.executor';
import { VerificationEngine } from '../application/verification.engine';
import { RetentionEngine } from '../application/retention.engine';
import { RestoreExecutor } from '../application/restore.executor';
import { RestoreTargetResolver } from '../application/restore-target.resolver';
import { RestoreRecoveryPointResolver } from '../application/restore-recovery-point.resolver';
import { RestoreValidator } from '../application/restore-validator';
import { BackupManifestValidator } from '../application/backup-manifest.validator';
import { BackupRestoreActivityEmitterService } from '../application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from '../application/backup-restore-job-observability.hooks';
import { BackupEngineObservabilityHooks } from '../application/backup-engine-observability.hooks';
import { VerificationRetentionObservabilityHooks } from '../application/verification-retention-observability.hooks';
import { RestoreEngineObservabilityHooks } from '../application/restore-engine-observability.hooks';
import { BackupDataCollector } from '../application/backup-data.collector';
import { BackupSnapshotBuilder } from '../application/backup-snapshot.builder';
import {
  BackupPolicyLoader,
  CatalogBackupTargetResolver,
} from '../application/backup-target-policy.resolvers';
import {
  EnvelopeEncryptionOrchestrator,
  GzipCompressionOrchestrator,
} from '../application/backup-compression-encryption.orchestrators';
import { InMemoryBackupRestoreJobRepository } from '../infrastructure/in-memory-backup-restore-job.repository';
import { MemoryBackupStorageProvider } from '../infrastructure/memory-backup-storage.provider';
import {
  InMemoryBackupSnapshotStore,
  InMemoryBackupVerificationRequestStore,
} from '../infrastructure/in-memory-backup-snapshot.store';
import {
  InMemoryCleanupPlanStore,
  InMemoryRetentionEvaluationStore,
  InMemoryVerificationResultStore,
} from '../infrastructure/verification-retention.stores';
import {
  InMemoryRestoreResultStore,
  InMemoryRestoreScratchStore,
} from '../infrastructure/in-memory-restore-result.store';
import type { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { createFoundationHealthController } from './backup-restore-foundation.helpers';
import { RESTORE_PIPELINE_STAGES } from '../domain/restore/restore-engine.types';
import { VERIFICATION_PIPELINE_STAGES } from '../domain/verification/verification-retention.types';

/**
 * Phase 43g — Production Acceptance integration scenarios A–D.
 * Validation only; no engine algorithm changes.
 */
describe('Phase 43g — Production Acceptance integration', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  const previousKeyRef = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
  const previousKey = process.env.BACKUP_RESTORE_TEST_KEY;

  let manager: BackupRestoreJobManager;
  let backup: BackupExecutor;
  let verification: VerificationEngine;
  let retention: RetentionEngine;
  let restore: RestoreExecutor;
  let storage: MemoryBackupStorageProvider;
  let snapshots: InMemoryBackupSnapshotStore;
  let activity: BackupRestoreActivityEmitterService;
  let notifications: BackupRestoreNotificationIntentRegistrar;
  let audit: BackupRestoreAuditLog;
  let backupObs: BackupEngineObservabilityHooks;
  let verifyObs: VerificationRetentionObservabilityHooks;
  let restoreObs: RestoreEngineObservabilityHooks;

  beforeEach(() => {
    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'true';
    process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF = 'BACKUP_RESTORE_TEST_KEY';
    process.env.BACKUP_RESTORE_TEST_KEY = randomBytes(32).toString('hex');

    const repo = new InMemoryBackupRestoreJobRepository();
    activity = new BackupRestoreActivityEmitterService();
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      drainRecorded: () => [],
    } as unknown as BackupRestoreAuditLog;
    notifications = new BackupRestoreNotificationIntentRegistrar();
    backupObs = new BackupEngineObservabilityHooks();
    verifyObs = new VerificationRetentionObservabilityHooks();
    restoreObs = new RestoreEngineObservabilityHooks();
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowBackupRestore: true,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    manager = new BackupRestoreJobManager(
      repo,
      activity,
      audit,
      notifications,
      new BackupRestoreJobObservabilityHooks(),
      tenantPolicy as never,
    );
    storage = new MemoryBackupStorageProvider();
    snapshots = new InMemoryBackupSnapshotStore();
    const requests = new InMemoryBackupVerificationRequestStore();
    const verificationResults = new InMemoryVerificationResultStore();
    const evaluations = new InMemoryRetentionEvaluationStore();
    const plans = new InMemoryCleanupPlanStore();

    backup = new BackupExecutor(
      manager,
      new CatalogBackupTargetResolver(),
      new BackupPolicyLoader(),
      new BackupDataCollector(),
      new BackupSnapshotBuilder(),
      new GzipCompressionOrchestrator(),
      new EnvelopeEncryptionOrchestrator(),
      storage,
      snapshots,
      requests,
      activity,
      audit,
      notifications,
      backupObs,
    );
    verification = new VerificationEngine(
      snapshots,
      requests,
      verificationResults,
      storage,
      new BackupManifestValidator(),
      activity,
      audit,
      notifications,
      verifyObs,
    );
    retention = new RetentionEngine(
      snapshots,
      evaluations,
      plans,
      activity,
      audit,
      notifications,
      verifyObs,
    );
    restore = new RestoreExecutor(
      manager,
      snapshots,
      storage,
      new InMemoryRestoreResultStore(),
      new InMemoryRestoreScratchStore(),
      new GzipCompressionOrchestrator(),
      new EnvelopeEncryptionOrchestrator(),
      new RestoreTargetResolver(),
      new RestoreRecoveryPointResolver(snapshots),
      new RestoreValidator(new BackupManifestValidator()),
      activity,
      audit,
      notifications,
      restoreObs,
    );
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.BACKUP_RESTORE_CENTER_ENABLED;
    else process.env.BACKUP_RESTORE_CENTER_ENABLED = previousFlag;
    if (previousKeyRef === undefined) delete process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
    else process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF = previousKeyRef;
    if (previousKey === undefined) delete process.env.BACKUP_RESTORE_TEST_KEY;
    else process.env.BACKUP_RESTORE_TEST_KEY = previousKey;
  });

  it('Scenario A — backup → verify → retention → restore → validation', async () => {
    const backupJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-a-backup',
      metadata: { source: 'test', targetId: 'tgt-43g-a' },
      queueImmediately: false,
    });
    const backupOut = await backup.executeBackup({
      tenantId: 't1',
      jobId: backupJob.id,
      leaseOwner: '43g-a',
    });
    expect(backupOut.snapshot.id).toBeTruthy();

    const verifyOut = await verification.verify({
      tenantId: 't1',
      snapshotId: backupOut.snapshot.id,
      requestId: backupOut.verificationRequest?.id,
      correlationId: 'corr-43g-a',
    });
    expect(verifyOut.status).toBe('verified');
    expect(verifyOut.stagesCompleted).toEqual([...VERIFICATION_PIPELINE_STAGES]);

    const { evaluation, cleanupPlan } = await retention.evaluate({
      tenantId: 't1',
      policy: { mode: 'by_days', retainDays: 30 },
      knownBackupJobIds: [backupOut.snapshot.backupJobId],
      correlationId: 'corr-43g-a-ret',
    });
    expect(evaluation.retainedSnapshotIds).toContain(backupOut.snapshot.id);
    expect(cleanupPlan.executed).toBe(false);

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-a-restore',
      metadata: {
        source: 'test',
        snapshotId: backupOut.snapshot.id,
        restoreMode: 'drill',
        restoreTargetKind: 'temporary_validation',
      },
      queueImmediately: false,
    });
    const restoreOut = await restore.executeRestore({
      tenantId: 't1',
      jobId: restoreJob.id,
      leaseOwner: '43g-a-restore',
    });
    expect(restoreOut.result.status).toBe('completed');
    expect(restoreOut.stagesCompleted).toEqual([...RESTORE_PIPELINE_STAGES]);
    expect(restoreOut.result.validation.valid).toBe(true);

    const events = activity.drainEmitted().map((e) => e.event);
    expect(events).toEqual(
      expect.arrayContaining([
        'backup_started',
        'backup_completed',
        'verification_started',
        'verification_completed',
        'retention_evaluated',
        'restore_started',
        'restore_completed',
      ]),
    );
    expect(notifications.drainRegistered().map((i) => i.kind)).toEqual(
      expect.arrayContaining([
        'backup_started',
        'verification_completed',
        'retention_evaluated',
        'restore_completed',
      ]),
    );
    expect((audit.record as jest.Mock).mock.calls.length).toBeGreaterThan(0);
    expect(backupObs.drain().backups).toBe(1);
    expect(verifyObs.drain().verificationSuccess).toBe(1);
    expect(restoreObs.drain().restores).toBe(1);
  });

  it('Scenario B — backup failure → verify failure path → recovery → successful backup', async () => {
    const badKey = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
    delete process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;

    const failJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-b-fail',
      metadata: { source: 'test', targetId: 'tgt-43g-b-fail' },
      queueImmediately: false,
    });
    await expect(
      backup.executeBackup({
        tenantId: 't1',
        jobId: failJob.id,
        leaseOwner: '43g-b-fail',
      }),
    ).rejects.toThrow();
    const failed = await manager.getJob('t1', failJob.id, {
      userId: 'user-1',
      roles: ['owner'],
    });
    expect(failed.status).toBe('failed');
    expect(failed.failureClass).toBe('ConfigurationFailure');

    process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF = badKey ?? 'BACKUP_RESTORE_TEST_KEY';

    const okJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-b-ok',
      metadata: { source: 'test', targetId: 'tgt-43g-b-ok' },
      queueImmediately: false,
    });
    const ok = await backup.executeBackup({
      tenantId: 't1',
      jobId: okJob.id,
      leaseOwner: '43g-b-ok',
    });

    await storage.put({
      storageKey: ok.snapshot.storageKey,
      body: Buffer.from('tampered-for-verify-fail'),
    });
    const badVerify = await verification.verify({
      tenantId: 't1',
      snapshotId: ok.snapshot.id,
      requestId: ok.verificationRequest?.id,
    });
    expect(badVerify.status).toBe('corrupted');

    // Recovery: fresh successful backup + verify
    const recoverJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-b-recover',
      metadata: { source: 'test', targetId: 'tgt-43g-b-recover' },
      queueImmediately: false,
    });
    const recovered = await backup.executeBackup({
      tenantId: 't1',
      jobId: recoverJob.id,
      leaseOwner: '43g-b-recover',
    });
    const goodVerify = await verification.verify({
      tenantId: 't1',
      snapshotId: recovered.snapshot.id,
      requestId: recovered.verificationRequest?.id,
    });
    expect(goodVerify.status).toBe('verified');
  });

  it('Scenario C — expired snapshot → retention → cleanup plan (no execution)', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-c',
      metadata: { source: 'test', targetId: 'tgt-43g-c' },
      queueImmediately: false,
    });
    const out = await backup.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: '43g-c',
    });
    await snapshots.markExpirationMetadata(
      't1',
      out.snapshot.id,
      new Date(Date.now() - 48 * 60 * 60 * 1000),
    );

    const { evaluation, cleanupPlan } = await retention.evaluate({
      tenantId: 't1',
      policy: { mode: 'by_days', retainDays: 1 },
      knownBackupJobIds: [out.snapshot.backupJobId],
    });
    expect(evaluation.expiredSnapshotIds).toContain(out.snapshot.id);
    expect(cleanupPlan.items.length).toBeGreaterThan(0);
    expect(cleanupPlan.executed).toBe(false);
    expect(cleanupPlan.estimatedReclaimedBytes).toBeGreaterThan(0);
    expect(await snapshots.findById('t1', out.snapshot.id)).not.toBeNull();
  });

  it('Scenario D — restore request → permission/validation → recovery point → complete', async () => {
    const backupJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-d-b',
      metadata: { source: 'test', targetId: 'tgt-43g-d' },
      queueImmediately: false,
    });
    const backupOut = await backup.executeBackup({
      tenantId: 't1',
      jobId: backupJob.id,
      leaseOwner: '43g-d-b',
    });
    await verification.verify({
      tenantId: 't1',
      snapshotId: backupOut.snapshot.id,
      requestId: backupOut.verificationRequest?.id,
    });

    await expect(
      restore.executeRestore({
        tenantId: 't1',
        jobId: (
          await manager.createJob({
            tenantId: 't1',
            kind: 'restore',
            typeId: 'postgres-logical',
            initiatedByUserId: 'user-1',
            actorRoles: ['owner'],
            idempotencyKey: '43g-d-deny',
            metadata: {
              source: 'test',
              snapshotId: backupOut.snapshot.id,
              restoreMode: 'drill',
              restoreTargetKind: 'temporary_validation',
            },
            queueImmediately: false,
          })
        ).id,
        leaseOwner: '43g-d-deny',
        allowBackupRestore: false,
        hasManagePermission: true,
      }),
    ).rejects.toThrow(/license|allowBackupRestore/i);

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: '43g-d-ok',
      metadata: {
        source: 'test',
        snapshotId: backupOut.snapshot.id,
        restoreMode: 'controlled',
        restoreTargetKind: 'original',
        approvedByUserId: 'approver-9',
        recoveryPointSelection: 'snapshot_identifier',
      },
      queueImmediately: false,
    });
    const out = await restore.executeRestore({
      tenantId: 't1',
      jobId: restoreJob.id,
      leaseOwner: '43g-d-ok',
      allowBackupRestore: true,
      hasManagePermission: true,
    });
    expect(out.result.status).toBe('completed');
    expect(out.result.recoveryPointId).toBe(backupOut.snapshot.recoveryPointId);
    expect(out.result.restoreMode).toBe('controlled');
  });

  it('Health + forbidden wiring remain production-safe', async () => {
    const health = await createFoundationHealthController().health();
    expect(health.phase).toBe('43f');
    expect(health.queue.wired).toBe(false);
    expect(health.worker.wired).toBe(false);
    expect(health.scheduler.wired).toBe(false);
    expect(health.backupEngine.ready).toBe(true);
    expect(health.verificationEngine.ready).toBe(true);
    expect(health.retentionEngine.ready).toBe(true);
    expect(health.retentionEngine.cleanupExecutionWired).toBe(false);
    expect(health.retentionEngine.deletionWired).toBe(false);
    expect(health.restoreEngine.ready).toBe(true);
    expect(health.restoreEngine.onlyVerifiedSnapshots).toBe(true);
    expect(health.jobEngine.ready).toBe(true);
  });
});
