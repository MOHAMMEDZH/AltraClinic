import { randomBytes } from 'crypto';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupExecutor } from '../application/backup.executor';
import { BackupRestoreActivityEmitterService } from '../application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from '../application/backup-restore-job-observability.hooks';
import { BackupEngineObservabilityHooks } from '../application/backup-engine-observability.hooks';
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
import type { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { BACKUP_PIPELINE_STAGES } from '../domain/backup/backup-engine.types';
import { NullRestoreService } from '../application/null-backup-restore.services';

describe('Phase 43c — Backup Engine', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  const previousKeyRef = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
  const previousKey = process.env.BACKUP_RESTORE_TEST_KEY;

  let manager: BackupRestoreJobManager;
  let executor: BackupExecutor;
  let storage: MemoryBackupStorageProvider;
  let snapshots: InMemoryBackupSnapshotStore;
  let verificationRequests: InMemoryBackupVerificationRequestStore;
  let activity: BackupRestoreActivityEmitterService;
  let notifications: BackupRestoreNotificationIntentRegistrar;
  let engineObs: BackupEngineObservabilityHooks;

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
    engineObs = new BackupEngineObservabilityHooks();
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
    verificationRequests = new InMemoryBackupVerificationRequestStore();
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
      verificationRequests,
      activity,
      audit,
      notifications,
      engineObs,
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

  async function createBackupJob(idempotencyKey: string, targetId = 'tgt-1') {
    return manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey,
      metadata: { source: 'test', targetId },
      queueImmediately: false,
    });
  }

  it('runs full backup pipeline and registers snapshot + verification request', async () => {
    const job = await createBackupJob('bak-1');
    const result = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'executor-1',
    });

    expect(result.stagesCompleted).toEqual([...BACKUP_PIPELINE_STAGES]);
    expect(result.snapshot.checksumSha256).toHaveLength(64);
    expect(result.snapshot.storageProvider).toBe('memory');
    expect(result.snapshot.manifest.schemaVersion).toBe('43c.1');
    expect(result.verificationRequest?.status).toBe('pending');

    const stored = await storage.get(result.snapshot.storageKey);
    expect(stored).not.toBeNull();
    expect(stored!.byteLength).toBe(result.snapshot.sizeBytes);

    const saved = await snapshots.findById('t1', result.snapshot.id);
    expect(saved?.backupJobId).toBe(job.id);

    const pending = await verificationRequests.listPendingByTenant('t1');
    expect(pending).toHaveLength(1);

    const finalJob = await manager.getJob('t1', job.id, {
      userId: 'user-1',
      roles: ['owner'],
    });
    expect(finalJob.status).toBe('verification_pending');

    const events = activity.drainEmitted().map((e) => e.event);
    expect(events).toContain('backup_started');
    expect(events).toContain('backup_completed');

    const intents = notifications.drainRegistered().map((i) => i.kind);
    expect(intents).toContain('backup_started');
    expect(intents).toContain('snapshot_registered');
    expect(intents).toContain('verification_requested');

    const metrics = engineObs.drain();
    expect(metrics.backups).toBe(1);
    expect(metrics.totalSnapshotBytes).toBeGreaterThan(0);
  });

  it('maps encryption configuration failures to ConfigurationFailure', async () => {
    delete process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
    const job = await createBackupJob('bak-fail-enc', 'tgt-enc');
    await expect(
      executor.executeBackup({
        tenantId: 't1',
        jobId: job.id,
        leaseOwner: 'executor-2',
      }),
    ).rejects.toThrow(/Encryption key unavailable/);

    const failed = await manager.getJob('t1', job.id, {
      userId: 'user-1',
      roles: ['owner'],
    });
    expect(failed.status).toBe('failed');
    expect(failed.failureClass).toBe('ConfigurationFailure');
    expect(engineObs.drain().failures).toBe(1);
  });

  it('rejects restore-kind jobs (no restore execution)', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'restore',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'restore-1',
      metadata: { source: 'test', snapshotId: 'snap-x' },
      queueImmediately: false,
    });
    await expect(
      executor.executeBackup({
        tenantId: 't1',
        jobId: job.id,
        leaseOwner: 'executor-3',
      }),
    ).rejects.toThrow(/kind=backup/);
    expect(new NullRestoreService().contractVersion).toBe('43a');
    expect(typeof (executor as { executeRestore?: unknown }).executeRestore).toBe('undefined');
  });

  it('compresses and encrypts using approved Node libraries only', async () => {
    const compression = new GzipCompressionOrchestrator();
    const encryption = new EnvelopeEncryptionOrchestrator();
    const raw = Buffer.from('hello-backup');
    const gz = compression.compress(raw);
    expect(gz.algorithm).toBe('gzip');
    expect(gz.outputBytes).toBeLessThanOrEqual(gz.inputBytes + 64);
    const enc = encryption.encrypt(gz.body, 'envelope');
    expect(enc.applied).toBe(true);
    expect(enc.algorithm).toBe('aes-256-gcm');
    const roundTrip = compression.decompress(encryption.decrypt(enc.body));
    expect(roundTrip.toString('utf8')).toBe('hello-backup');
  });
});
