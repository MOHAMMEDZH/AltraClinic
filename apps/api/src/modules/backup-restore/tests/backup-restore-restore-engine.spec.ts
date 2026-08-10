import { randomBytes } from 'crypto';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupExecutor } from '../application/backup.executor';
import { VerificationEngine } from '../application/verification.engine';
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
import { InMemoryVerificationResultStore } from '../infrastructure/verification-retention.stores';
import {
  InMemoryRestoreResultStore,
  InMemoryRestoreScratchStore,
} from '../infrastructure/in-memory-restore-result.store';
import type { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { RESTORE_PIPELINE_STAGES } from '../domain/restore/restore-engine.types';
import { NullRetentionService } from '../application/null-backup-restore.services';

describe('Phase 43e — Restore Engine', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  const previousKeyRef = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
  const previousKey = process.env.BACKUP_RESTORE_TEST_KEY;

  let manager: BackupRestoreJobManager;
  let executor: BackupExecutor;
  let verification: VerificationEngine;
  let restore: RestoreExecutor;
  let storage: MemoryBackupStorageProvider;
  let snapshots: InMemoryBackupSnapshotStore;
  let results: InMemoryRestoreResultStore;
  let scratch: InMemoryRestoreScratchStore;
  let activity: BackupRestoreActivityEmitterService;
  let notifications: BackupRestoreNotificationIntentRegistrar;
  let restoreObs: RestoreEngineObservabilityHooks;

  beforeEach(() => {
    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'true';
    process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF = 'BACKUP_RESTORE_TEST_KEY';
    process.env.BACKUP_RESTORE_TEST_KEY = randomBytes(32).toString('hex');

    const repo = new InMemoryBackupRestoreJobRepository();
    activity = new BackupRestoreActivityEmitterService();
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
      drainRecorded: () => [],
    } as unknown as BackupRestoreAuditLog;
    notifications = new BackupRestoreNotificationIntentRegistrar();
    const jobObs = new BackupRestoreJobObservabilityHooks();
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
      jobObs,
      tenantPolicy as never,
    );
    storage = new MemoryBackupStorageProvider();
    snapshots = new InMemoryBackupSnapshotStore();
    const requests = new InMemoryBackupVerificationRequestStore();
    const verificationResults = new InMemoryVerificationResultStore();
    results = new InMemoryRestoreResultStore();
    scratch = new InMemoryRestoreScratchStore();

    executor = new BackupExecutor(
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
      new BackupEngineObservabilityHooks(),
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
      new VerificationRetentionObservabilityHooks(),
    );

    restore = new RestoreExecutor(
      manager,
      snapshots,
      storage,
      results,
      scratch,
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

  async function backupAndVerify(idempotencyKey: string) {
    const backupJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey,
      metadata: { source: 'test', targetId: `tgt-${idempotencyKey}` },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: backupJob.id,
      leaseOwner: `exec-${idempotencyKey}`,
    });
    await verification.verify({
      tenantId: 't1',
      snapshotId: backup.snapshot.id,
      requestId: backup.verificationRequest?.id,
    });
    return backup;
  }

  it('restores a verified snapshot end-to-end (drill)', async () => {
    const backup = await backupAndVerify('rest-1');

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-1',
      metadata: {
        source: 'test',
        snapshotId: backup.snapshot.id,
        restoreMode: 'drill',
        restoreTargetKind: 'temporary_validation',
      },
      queueImmediately: false,
    });

    const outcome = await restore.executeRestore({
      tenantId: 't1',
      jobId: restoreJob.id,
      leaseOwner: 'restore-exec-1',
    });

    expect(outcome.result.status).toBe('completed');
    expect(outcome.stagesCompleted).toEqual([...RESTORE_PIPELINE_STAGES]);
    expect(outcome.result.objectsRestored).toBeGreaterThan(0);
    expect(outcome.result.bytesRestored).toBeGreaterThan(0);
    expect(outcome.result.snapshotId).toBe(backup.snapshot.id);

    const scratchRow = await scratch.findByRestoreId('t1', outcome.result.id);
    expect(scratchRow?.logicalDataKeys.length).toBeGreaterThan(0);

    const completed = await manager.getJob('t1', restoreJob.id, {
      userId: 'user-1',
      roles: ['owner'],
    });
    expect(completed.status).toBe('completed');
    expect(completed.progress.percent).toBe(100);

    expect(restoreObs.drain().restores).toBe(1);
    const intents = notifications.drainRegistered().map((i) => i.kind);
    expect(intents).toContain('restore_completed');
    expect(intents).toContain('recovery_point_selected');
  });

  it('rejects restore of unverified snapshots', async () => {
    const backupJob = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'unverified',
      metadata: { source: 'test', targetId: 'tgt-unverified' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: backupJob.id,
      leaseOwner: 'exec-unverified',
    });
    expect(backup.snapshot.verificationStatus).not.toBe('passed');

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-unverified',
      metadata: {
        source: 'test',
        snapshotId: backup.snapshot.id,
        restoreMode: 'drill',
        restoreTargetKind: 'temporary_validation',
      },
      queueImmediately: false,
    });

    await expect(
      restore.executeRestore({
        tenantId: 't1',
        jobId: restoreJob.id,
        leaseOwner: 'restore-bad',
      }),
    ).rejects.toThrow(/VERIFIED|verified/i);

    const failed = await manager.getJob('t1', restoreJob.id, {
      userId: 'user-1',
      roles: ['owner'],
    });
    expect(failed.status).toBe('failed');
  });

  it('requires dual-control approver for controlled restore', async () => {
    const backup = await backupAndVerify('rest-ctrl');

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-ctrl-fail',
      metadata: {
        source: 'test',
        snapshotId: backup.snapshot.id,
        restoreMode: 'controlled',
        restoreTargetKind: 'original',
        // missing approvedByUserId
      },
      queueImmediately: false,
    });

    await expect(
      restore.executeRestore({
        tenantId: 't1',
        jobId: restoreJob.id,
        leaseOwner: 'restore-ctrl',
      }),
    ).rejects.toThrow(/dual-control|approvedByUserId/i);
  });

  it('completes controlled restore with distinct approver', async () => {
    const backup = await backupAndVerify('rest-ctrl-ok');

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-ctrl-ok',
      metadata: {
        source: 'test',
        snapshotId: backup.snapshot.id,
        restoreMode: 'controlled',
        restoreTargetKind: 'original',
        approvedByUserId: 'approver-2',
      },
      queueImmediately: false,
    });

    const outcome = await restore.executeRestore({
      tenantId: 't1',
      jobId: restoreJob.id,
      leaseOwner: 'restore-ctrl-ok',
    });
    expect(outcome.result.status).toBe('completed');
    expect(outcome.result.restoreMode).toBe('controlled');
  });

  it('does not delete snapshots and does not wire retention deletion', async () => {
    const backup = await backupAndVerify('rest-no-del');
    const before = await snapshots.findById('t1', backup.snapshot.id);
    expect(before).not.toBeNull();

    const restoreJob = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-no-del',
      metadata: {
        source: 'test',
        snapshotId: backup.snapshot.id,
        restoreMode: 'drill',
        restoreTargetKind: 'tenant_sandbox',
      },
      queueImmediately: false,
    });
    await restore.executeRestore({
      tenantId: 't1',
      jobId: restoreJob.id,
      leaseOwner: 'restore-no-del',
    });

    expect(await snapshots.findById('t1', backup.snapshot.id)).not.toBeNull();
    expect(typeof (restore as { deleteSnapshot?: unknown }).deleteSnapshot).toBe('undefined');
    expect(new NullRetentionService().contractVersion).toBe('43a');
  });
});
