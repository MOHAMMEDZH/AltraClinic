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
import { BackupRestoreJobsController } from '../controllers/backup-restore-jobs.controller';
import { BackupRestoreSnapshotsController } from '../controllers/backup-restore-snapshots.controller';
import { BackupRestoreOpsReadController } from '../controllers/backup-restore-ops-read.controller';
import { BackupRestoreCatalogController } from '../controllers/backup-restore-catalog.controller';
import { EffectiveBackupRestoreViewService } from '../application/effective-backup-restore-view.service';
import { BackupRestoreExtensionRegistry } from '../application/backup-restore-extension.registry';
import {
  toPublicBackupRestoreJob,
  toPublicSnapshot,
} from '../application/public-backup-restore.mapper';

describe('Phase 43f — Operations API (thin controllers)', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  const previousKeyRef = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
  const previousKey = process.env.BACKUP_RESTORE_TEST_KEY;

  let manager: BackupRestoreJobManager;
  let executor: BackupExecutor;
  let verification: VerificationEngine;
  let snapshots: InMemoryBackupSnapshotStore;
  let jobsController: BackupRestoreJobsController;
  let snapshotsController: BackupRestoreSnapshotsController;
  let opsRead: BackupRestoreOpsReadController;
  let catalogController: BackupRestoreCatalogController;
  let verificationResults: InMemoryVerificationResultStore;

  const user = {
    sub: 'user-1',
    tenantId: 't1',
    branchId: null,
    roles: ['owner'],
  } as never;

  beforeEach(() => {
    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'true';
    process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF = 'BACKUP_RESTORE_TEST_KEY';
    process.env.BACKUP_RESTORE_TEST_KEY = randomBytes(32).toString('hex');

    const repo = new InMemoryBackupRestoreJobRepository();
    const activity = new BackupRestoreActivityEmitterService();
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
      drainRecorded: () => [],
    } as unknown as BackupRestoreAuditLog;
    const notifications = new BackupRestoreNotificationIntentRegistrar();
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
    const storage = new MemoryBackupStorageProvider();
    snapshots = new InMemoryBackupSnapshotStore();
    const requests = new InMemoryBackupVerificationRequestStore();
    verificationResults = new InMemoryVerificationResultStore();
    const retentionEval = new InMemoryRetentionEvaluationStore();
    const cleanup = new InMemoryCleanupPlanStore();

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

    jobsController = new BackupRestoreJobsController(manager);
    snapshotsController = new BackupRestoreSnapshotsController(snapshots);
    opsRead = new BackupRestoreOpsReadController(
      verificationResults,
      retentionEval,
      cleanup,
    );
    catalogController = new BackupRestoreCatalogController(
      new EffectiveBackupRestoreViewService(
        new BackupRestoreExtensionRegistry(),
        tenantPolicy as never,
      ),
    );

    // silence unused restore wiring in this suite
    void new RestoreExecutor(
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
      new RestoreEngineObservabilityHooks(),
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

  it('lists jobs and snapshots for operations UI', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'ops-1',
      metadata: { source: 'test', targetId: 'tgt-ops' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'ops',
    });
    await verification.verify({
      tenantId: 't1',
      snapshotId: backup.snapshot.id,
      requestId: backup.verificationRequest?.id,
    });

    const listed = await jobsController.list(user, 'backup');
    expect(listed.jobs.some((j) => j.id === job.id)).toBe(true);
    expect(toPublicBackupRestoreJob(job).correlationId).toBeTruthy();

    const snapList = await snapshotsController.list(user);
    expect(snapList.snapshots.some((s) => s.id === backup.snapshot.id)).toBe(true);
    expect(toPublicSnapshot(backup.snapshot).manifest.keyReference).toBe('[redacted]');

    const rp = await snapshotsController.recoveryPoints(user);
    expect(rp.recoveryPoints.some((p) => p.snapshotId === backup.snapshot.id && p.restoreAvailable)).toBe(
      true,
    );

    const verify = await opsRead.verification(user);
    expect(verify.results.length).toBeGreaterThan(0);

    const catalog = await catalogController.catalog(user);
    expect(catalog.types.length).toBeGreaterThan(0);
    expect(catalog.catalog.featureEnabled).toBe(true);
  });
});
