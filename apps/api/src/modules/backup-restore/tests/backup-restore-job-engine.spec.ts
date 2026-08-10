import {
  assertBackupRestoreJobTransition,
  canTransitionBackupRestoreJobStatus,
  IllegalBackupRestoreJobTransitionError,
  isCancellableBackupRestoreJobStatus,
} from '../domain/job/backup-restore-job-state-machine';
import { BackupRestoreRetryEngine } from '../application/backup-restore-retry.engine';
import { BackupRestoreJobManager } from '../application/backup-restore-job.manager';
import { BackupRestoreActivityEmitterService } from '../application/backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from '../application/backup-restore-notification-intent.registrar';
import { BackupRestoreJobObservabilityHooks } from '../application/backup-restore-job-observability.hooks';
import { InMemoryBackupRestoreJobRepository } from '../infrastructure/in-memory-backup-restore-job.repository';
import type { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';

describe('Phase 43b — Backup & Restore Job Engine', () => {
  const previousFlag = process.env.BACKUP_RESTORE_CENTER_ENABLED;
  let repo: InMemoryBackupRestoreJobRepository;
  let activity: BackupRestoreActivityEmitterService;
  let audit: BackupRestoreAuditLog;
  let notifications: BackupRestoreNotificationIntentRegistrar;
  let observability: BackupRestoreJobObservabilityHooks;
  let manager: BackupRestoreJobManager;

  const owner = { userId: 'user-1', roles: ['owner'] };

  beforeEach(() => {
    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'true';
    repo = new InMemoryBackupRestoreJobRepository();
    activity = new BackupRestoreActivityEmitterService();
    audit = {
      record: jest.fn().mockResolvedValue(undefined),
      drainRecorded: () => [],
    } as unknown as BackupRestoreAuditLog;
    notifications = new BackupRestoreNotificationIntentRegistrar();
    observability = new BackupRestoreJobObservabilityHooks();
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
      observability,
      tenantPolicy as never,
    );
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.BACKUP_RESTORE_CENTER_ENABLED;
    else process.env.BACKUP_RESTORE_CENTER_ENABLED = previousFlag;
  });

  it('validates legal and illegal state transitions', () => {
    expect(canTransitionBackupRestoreJobStatus('created', 'queued')).toBe(true);
    expect(canTransitionBackupRestoreJobStatus('running', 'completed')).toBe(true);
    expect(canTransitionBackupRestoreJobStatus('completed', 'queued')).toBe(false);
    expect(() => assertBackupRestoreJobTransition('cancelled', 'running')).toThrow(
      IllegalBackupRestoreJobTransitionError,
    );
    expect(isCancellableBackupRestoreJobStatus('queued')).toBe(true);
    expect(isCancellableBackupRestoreJobStatus('completed')).toBe(false);
  });

  it('creates jobs idempotently and stays created when queueImmediately=false', async () => {
    const first = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-1',
      metadata: { source: 'test', targetId: 'tgt-a' },
      queueImmediately: false,
    });
    expect(first.status).toBe('created');
    const second = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-1',
      metadata: { source: 'test', targetId: 'tgt-a' },
      queueImmediately: false,
    });
    expect(second.id).toBe(first.id);
    const events = activity.drainEmitted();
    expect(events.some((e) => e.event === 'job_created')).toBe(true);
    expect(audit.record).toHaveBeenCalled();
  });

  it('marks queued without wiring a queue consumer', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-q',
      metadata: { source: 'test', targetId: 'tgt-q' },
      queueImmediately: true,
    });
    expect(job.status).toBe('queued');
    const intents = notifications.drainRegistered();
    expect(intents.some((i) => i.kind === 'job_queued')).toBe(true);
    const health = await manager.getEngineHealth('t1');
    expect(health.queueWired).toBe(false);
    expect(health.workerWired).toBe(false);
  });

  it('starts, tracks progress, and completes without executing backup', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-run',
      metadata: { source: 'test', targetId: 'tgt-run' },
    });
    job = await manager.startJob('t1', job.id, 'lease-1');
    expect(job.status).toBe('running');
    expect(job.leaseOwner).toBe('lease-1');
    expect(job.attemptCount).toBe(1);

    job = await manager.updateProgress('t1', job.id, {
      percent: 40,
      phase: 'orchestration',
      step: 2,
      stepCount: 5,
      statusMessage: 'Tracking only',
    });
    expect(job.progress.percent).toBe(40);
    expect(job.progress.stepCount).toBe(5);

    job = await manager.markCompleted('t1', job.id);
    expect(job.status).toBe('completed');
    expect(job.progress.percent).toBe(100);
    expect(typeof (manager as { executeBackup?: unknown }).executeBackup).toBe('undefined');
  });

  it('rejects duplicate active jobs for same target (logical lock)', async () => {
    await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-dup-1',
      metadata: { source: 'test', targetId: 'same-target' },
    });
    await expect(
      manager.createJob({
        tenantId: 't1',
        kind: 'backup',
        typeId: 'postgres-logical',
        initiatedByUserId: 'user-1',
        actorRoles: ['owner'],
        idempotencyKey: 'idem-dup-2',
        metadata: { source: 'test', targetId: 'same-target' },
      }),
    ).rejects.toThrow(/Duplicate/);
  });

  it('rejects double lease from another owner', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-lease',
      metadata: { source: 'test', targetId: 'tgt-lease' },
    });
    job = await manager.startJob('t1', job.id, 'owner-a');
    await expect(manager.startJob('t1', job.id, 'owner-b')).rejects.toThrow(/leased/);
  });

  it('retries then dead-letters according to retry policy', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-retry',
      metadata: { source: 'test', targetId: 'tgt-retry' },
      maxAttempts: 1,
    });
    job = await manager.startJob('t1', job.id, 'lease-r');
    job = await manager.markFailed('t1', job.id, 'SystemFailure', 'boom');
    expect(job.status).toBe('dead_letter');
    const dlq = await repo.listDeadLetters('t1');
    expect(dlq).toHaveLength(1);
    expect(activity.drainEmitted().some((e) => e.event === 'job_dead_letter')).toBe(true);
  });

  it('schedules retry metadata when attempts remain', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-retry2',
      metadata: { source: 'test', targetId: 'tgt-retry2' },
      maxAttempts: 3,
    });
    job = await manager.startJob('t1', job.id, 'lease-r2');
    job = await manager.markFailed('t1', job.id, 'StorageFailure', 'storage down');
    expect(job.status).toBe('queued');
    expect(job.metadata.lastRetryDelayMs).toBeDefined();
    expect(observability.drainCounters().retries).toBeGreaterThan(0);
  });

  it('cancels queued jobs and rejects cancel of completed', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-cancel',
      metadata: { source: 'test', targetId: 'tgt-cancel' },
    });
    job = await manager.cancelJob('t1', job.id, owner, 'user');
    expect(job.status).toBe('cancelled');
    expect(job.cancelReason).toBe('user');

    let done = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'media-prefix',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-cancel-done',
      metadata: { source: 'test', targetId: 'tgt-cancel-done' },
    });
    done = await manager.startJob('t1', done.id, 'lease-c');
    done = await manager.markCompleted('t1', done.id);
    await expect(manager.cancelJob('t1', done.id, owner)).rejects.toThrow(/Cannot cancel/);
  });

  it('pause and resume running jobs', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-pause',
      metadata: { source: 'test', targetId: 'tgt-pause' },
    });
    job = await manager.startJob('t1', job.id, 'lease-p');
    job = await manager.pauseJob('t1', job.id, owner);
    expect(job.status).toBe('paused');
    job = await manager.resumeJob('t1', job.id, owner);
    expect(job.status).toBe('running');
  });

  it('expires due jobs', async () => {
    const job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-exp',
      metadata: { source: 'test', targetId: 'tgt-exp' },
      queueImmediately: false,
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const count = await manager.expireDueJobs(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const loaded = await manager.getJob('t1', job.id, owner);
    expect(loaded.status).toBe('expired');
  });

  it('enforces feature flag, license, RBAC, and restore metadata', async () => {
    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'false';
    await expect(
      manager.createJob({
        tenantId: 't1',
        kind: 'backup',
        typeId: 'postgres-logical',
        initiatedByUserId: 'user-1',
        actorRoles: ['owner'],
        idempotencyKey: 'idem-flag',
        metadata: { source: 'test', targetId: 'tgt-flag' },
      }),
    ).rejects.toThrow(/BACKUP_RESTORE_CENTER_ENABLED=false/);

    process.env.BACKUP_RESTORE_CENTER_ENABLED = 'true';
    await expect(
      manager.createJob({
        tenantId: 't1',
        kind: 'backup',
        typeId: 'postgres-logical',
        initiatedByUserId: 'user-1',
        actorRoles: ['patient'],
        idempotencyKey: 'idem-rbac',
        metadata: { source: 'test', targetId: 'tgt-rbac' },
      }),
    ).rejects.toThrow(/permission/);

    await expect(
      manager.createJob({
        tenantId: 't1',
        kind: 'restore',
        typeId: 'postgres-logical',
        initiatedByUserId: 'user-1',
        actorRoles: ['owner'],
        idempotencyKey: 'idem-restore-meta',
        metadata: { source: 'test' },
      }),
    ).rejects.toThrow(/snapshotId/);
  });

  it('rejects license when allowBackupRestore=false', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowBackupRestore: false,
        allowDataImport: true,
        allowDataExport: true,
        maintenanceMode: false,
      }),
    };
    const denied = new BackupRestoreJobManager(
      repo,
      activity,
      audit,
      notifications,
      observability,
      tenantPolicy as never,
    );
    await expect(
      denied.createJob({
        tenantId: 't1',
        kind: 'backup',
        typeId: 'postgres-logical',
        initiatedByUserId: 'user-1',
        actorRoles: ['owner'],
        idempotencyKey: 'idem-lic',
        metadata: { source: 'test', targetId: 'tgt-lic' },
      }),
    ).rejects.toThrow(/allowBackupRestore/);
  });

  it('retry engine computes delay and DLQ decision', () => {
    const engine = new BackupRestoreRetryEngine();
    const job = {
      attemptCount: 1,
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 60_000,
    } as BackupRestoreJob;
    const retry = engine.decide(job);
    expect(retry.shouldRetry).toBe(true);
    expect(retry.delayMs).toBe(1000);

    const dlq = engine.decide({ ...job, attemptCount: 3 });
    expect(dlq.shouldDeadLetter).toBe(true);
  });

  it('verification_pending path registers intent without running verify engine', async () => {
    let job = await manager.createJob({
      tenantId: 't1',
      kind: 'backup',
      typeId: 'postgres-logical',
      initiatedByUserId: 'user-1',
      actorRoles: ['owner'],
      idempotencyKey: 'idem-verify',
      metadata: { source: 'test', targetId: 'tgt-verify' },
    });
    job = await manager.startJob('t1', job.id, 'lease-v');
    job = await manager.markCompleted('t1', job.id, { withVerification: true });
    expect(job.status).toBe('verification_pending');
    expect(notifications.drainRegistered().some((i) => i.kind === 'verification_pending')).toBe(
      true,
    );
    job = await manager.markVerified('t1', job.id);
    expect(job.status).toBe('verified');
  });
});
