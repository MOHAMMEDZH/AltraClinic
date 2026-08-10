import { randomBytes } from 'crypto';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupExecutor } from '../application/backup.executor';
import { VerificationEngine } from '../application/verification.engine';
import { RetentionEngine } from '../application/retention.engine';
import { BackupManifestValidator } from '../application/backup-manifest.validator';
import { BackupRestoreActivityEmitterService } from '../application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from '../application/backup-restore-job-observability.hooks';
import { BackupEngineObservabilityHooks } from '../application/backup-engine-observability.hooks';
import { VerificationRetentionObservabilityHooks } from '../application/verification-retention-observability.hooks';
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
import type { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import {
  assertVerificationTransition,
  canTransitionVerificationStatus,
  IllegalVerificationTransitionError,
} from '../domain/verification/verification-state-machine';
import { VERIFICATION_PIPELINE_STAGES } from '../domain/verification/verification-retention.types';
import { NullRestoreService } from '../application/null-backup-restore.services';

describe('Phase 43d — Verification & Retention', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  const previousKeyRef = process.env.BACKUP_RESTORE_ENCRYPTION_KEY_REF;
  const previousKey = process.env.BACKUP_RESTORE_TEST_KEY;

  let manager: BackupRestoreJobManager;
  let executor: BackupExecutor;
  let verification: VerificationEngine;
  let retention: RetentionEngine;
  let storage: MemoryBackupStorageProvider;
  let snapshots: InMemoryBackupSnapshotStore;
  let requests: InMemoryBackupVerificationRequestStore;
  let results: InMemoryVerificationResultStore;
  let evaluations: InMemoryRetentionEvaluationStore;
  let plans: InMemoryCleanupPlanStore;
  let activity: BackupRestoreActivityEmitterService;
  let notifications: BackupRestoreNotificationIntentRegistrar;
  let vrObs: VerificationRetentionObservabilityHooks;

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
    vrObs = new VerificationRetentionObservabilityHooks();
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
    requests = new InMemoryBackupVerificationRequestStore();
    results = new InMemoryVerificationResultStore();
    evaluations = new InMemoryRetentionEvaluationStore();
    plans = new InMemoryCleanupPlanStore();

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
      results,
      storage,
      new BackupManifestValidator(),
      activity,
      audit,
      notifications,
      vrObs,
    );

    retention = new RetentionEngine(
      snapshots,
      evaluations,
      plans,
      activity,
      audit,
      notifications,
      vrObs,
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

  it('validates verification state transitions', () => {
    expect(canTransitionVerificationStatus('pending', 'running')).toBe(true);
    expect(canTransitionVerificationStatus('running', 'verified')).toBe(true);
    expect(canTransitionVerificationStatus('verified', 'running')).toBe(false);
    expect(() => assertVerificationTransition('expired', 'verified')).toThrow(
      IllegalVerificationTransitionError,
    );
  });

  it('verifies a completed backup snapshot end-to-end', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'v-1',
      metadata: { source: 'test', targetId: 'tgt-v1' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'exec-v',
    });

    const result = await verification.verify({
      tenantId: 't1',
      snapshotId: backup.snapshot.id,
      requestId: backup.verificationRequest?.id,
      correlationId: 'corr-v1',
    });

    expect(result.status).toBe('verified');
    expect(result.stagesCompleted).toEqual([...VERIFICATION_PIPELINE_STAGES]);
    expect(result.checksumActual).toBe(backup.snapshot.checksumSha256);
    expect(result.transitions.some((t) => t.to === 'verified')).toBe(true);

    const snap = await snapshots.findById('t1', backup.snapshot.id);
    expect(snap?.verificationStatus).toBe('passed');

    const metrics = vrObs.drain();
    expect(metrics.verificationSuccess).toBe(1);

    const intents = notifications.drainRegistered().map((i) => i.kind);
    expect(intents).toContain('verification_completed');
  });

  it('marks corrupted when checksum mismatches', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'v-bad',
      metadata: { source: 'test', targetId: 'tgt-bad' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'exec-bad',
    });

    await storage.put({
      storageKey: backup.snapshot.storageKey,
      body: Buffer.from('tampered'),
    });

    const result = await verification.verify({
      tenantId: 't1',
      snapshotId: backup.snapshot.id,
      requestId: backup.verificationRequest?.id,
    });

    expect(result.status).toBe('corrupted');
    expect(result.failureReason).toMatch(/checksum/i);
    expect(vrObs.drain().verificationFailures).toBe(1);
  });

  it('evaluates retention and builds cleanup plan without deleting', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'ret-1',
      metadata: { source: 'test', targetId: 'tgt-ret' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'exec-ret',
    });

    // Force expiration metadata into the past
    await snapshots.markExpirationMetadata(
      't1',
      backup.snapshot.id,
      new Date(Date.now() - 24 * 60 * 60 * 1000),
    );

    const { evaluation, cleanupPlan } = await retention.evaluate({
      tenantId: 't1',
      policy: { mode: 'by_days', retainDays: 1 },
      knownBackupJobIds: [backup.snapshot.backupJobId],
    });

    expect(evaluation.expiredSnapshotIds).toContain(backup.snapshot.id);
    expect(cleanupPlan.executed).toBe(false);
    expect(cleanupPlan.items.some((i) => i.snapshotId === backup.snapshot.id)).toBe(true);
    expect(cleanupPlan.estimatedReclaimedBytes).toBeGreaterThan(0);

    // Snapshot still present — no deletion
    expect(await snapshots.findById('t1', backup.snapshot.id)).not.toBeNull();
    expect(typeof (retention as { deleteSnapshot?: unknown }).deleteSnapshot).toBe('undefined');
    expect(new NullRestoreService().contractVersion).toBe('43a');
  });

  it('supports retain forever / legal hold without expiring', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'media-prefix',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'ret-hold',
      metadata: { source: 'test', targetId: 'tgt-hold' },
      queueImmediately: false,
    });
    const backup = await executor.executeBackup({
      tenantId: 't1',
      jobId: job.id,
      leaseOwner: 'exec-hold',
    });

    const { evaluation, cleanupPlan } = await retention.evaluate({
      tenantId: 't1',
      policy: { mode: 'legal_hold', legalHold: true },
    });

    expect(evaluation.legalHoldSnapshotIds).toContain(backup.snapshot.id);
    expect(evaluation.expiredSnapshotIds).toHaveLength(0);
    expect(cleanupPlan.items).toHaveLength(0);
  });
});
