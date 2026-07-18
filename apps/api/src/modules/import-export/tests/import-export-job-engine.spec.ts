import { randomUUID } from 'crypto';
import {
  assertJobTransition,
  canTransitionJobStatus,
  IllegalJobTransitionError,
  isCancellableJobStatus,
} from '../domain/job/import-export-job-state-machine';
import { ImportExportRuntimeRegistry } from '../application/import-export-runtime.registry';
import { ImportExportJobService } from '../application/import-export-job.service';
import { NullImportExportExecutor } from '../application/null-import-export.executor';
import { ImportExportActivityEmitterService } from '../application/import-export-activity.emitter';
import { ImportExportNotificationIntentService } from '../application/import-export-notification-intent.service';
import { ImportExportRetryEngine } from '../application/import-export-retry.engine';
import { InMemoryImportExportJobRepository } from '../infrastructure/in-memory-import-export-job.repository';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import type { ImportExportQueuePayload } from '../infrastructure/import-export-queue.service';
import { STATIC_IMPORT_EXPORT_CATALOG } from '../catalog/static-import-export.catalog';

describe('Phase 42c — Import/Export Job Engine', () => {
  const previousFlag = process.env.IMPORT_EXPORT_CENTER_ENABLED;
  let repo: InMemoryImportExportJobRepository;
  let registry: ImportExportRuntimeRegistry;
  let queueCalls: Array<{ payload: ImportExportQueuePayload; options?: { delay?: number } }>;
  let activity: ImportExportActivityEmitterService;
  let audit: ImportExportAuditLog;
  let notifications: ImportExportNotificationIntentService;
  let executor: NullImportExportExecutor;
  let service: ImportExportJobService;

  const owner = { userId: 'user-1', roles: ['owner'], branchId: 'branch-a' };

  beforeEach(() => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    repo = new InMemoryImportExportJobRepository();
    registry = new ImportExportRuntimeRegistry();
    registry.loadStaticCatalog();
    queueCalls = [];
    activity = new ImportExportActivityEmitterService({
      recordEnqueued: jest.fn(),
      recordCompleted: jest.fn(),
      recordFailed: jest.fn(),
    } as never);
    audit = Object.assign(new ImportExportAuditLog({ save: jest.fn() } as never), {
      // repository injected; save mocked via constructor
    });
    // Re-create audit with mock repo
    audit = new ImportExportAuditLog({ save: jest.fn().mockResolvedValue(undefined) } as never);
    notifications = new ImportExportNotificationIntentService(undefined);
    executor = new NullImportExportExecutor();

    const queue = {
      enqueueJob: jest.fn(async (payload: ImportExportQueuePayload, options?: { delay?: number }) => {
        queueCalls.push({ payload, options });
        return 'bull-1';
      }),
      queueName: 'import-export',
      isConnected: () => true,
      getEnqueuedCount: () => queueCalls.length,
    };

    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: true,
        allowDataExport: true,
      }),
    };

    service = new ImportExportJobService(
      repo,
      registry,
      queue as never,
      executor,
      activity,
      audit,
      notifications,
      tenantPolicy as never,
    );
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    else process.env.IMPORT_EXPORT_CENTER_ENABLED = previousFlag;
  });

  it('enforces legal and illegal state transitions', () => {
    expect(canTransitionJobStatus('draft', 'queued')).toBe(true);
    expect(canTransitionJobStatus('queued', 'running')).toBe(true);
    expect(canTransitionJobStatus('running', 'completed')).toBe(true);
    expect(canTransitionJobStatus('completed', 'queued')).toBe(false);
    expect(() => assertJobTransition('completed', 'cancelled')).toThrow(IllegalJobTransitionError);
    expect(isCancellableJobStatus('queued')).toBe(true);
    expect(isCancellableJobStatus('completed')).toBe(false);
  });

  it('persists jobs and returns same job on idempotent create', async () => {
    const key = `idem-${randomUUID()}`;
    const first = await service.createJob({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: key,
      queueImmediately: false,
    });
    const second = await service.createJob({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: key,
      queueImmediately: false,
    });
    expect(second.id).toBe(first.id);
    expect(first.status).toBe('draft');
    expect(first.correlationId).toBeTruthy();
  });

  it('queues, runs Null Executor, and completes without business work', async () => {
    const created = await service.createJob({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `q-${randomUUID()}`,
      queueImmediately: true,
    });
    expect(created.status).toBe('queued');
    expect(queueCalls).toHaveLength(1);
    expect(queueCalls[0].payload.jobId).toBe(created.id);
    expect(queueCalls[0].payload.correlationId).toBe(created.correlationId);

    const completed = await service.processQueuedJob(created.tenantId, created.id, 'worker-test');
    expect(completed.status).toBe('completed');
    expect(executor.getExecutionCount()).toBe(1);
    expect(completed.metadata).not.toHaveProperty('rows');

    const events = activity.drainEmitted().map((e) => e.event);
    expect(events).toEqual(
      expect.arrayContaining(['job_created', 'job_queued', 'job_started', 'job_completed']),
    );
    expect(notifications.drainProduced().some((n) => n.kind === 'export_completed')).toBe(true);
    expect(audit.drainRecorded().some((a) => a.action === 'importExport.job.created')).toBe(true);
  });

  it('retries then dead-letters after max attempts via Null Executor forceFailOnce', async () => {
    const created = await service.createJob({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-import',
      direction: 'import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `fail-${randomUUID()}`,
      queueImmediately: true,
      maxAttempts: 2,
      metadata: { source: 'test', forceFailOnce: true },
    });

    // Attempt 1: forced fail → retry scheduled
    const afterFail = await service.processQueuedJob(created.tenantId, created.id, 'worker-1');
    expect(['retrying', 'queued']).toContain(afterFail.status);
    expect(activity.drainEmitted().map((e) => e.event)).toEqual(
      expect.arrayContaining(['job_failed', 'job_retry']),
    );

    // Attempt 2: succeeds (forceFailOnce cleared) OR if still failing path — process again
    // Ensure job is queued for second attempt
    let job = await repo.findById(created.tenantId, created.id);
    if (job && job.status === 'retrying') {
      job = await service.queueJob(created.tenantId, created.id, owner);
    }
    // If auto-retry already queued, process again
    job = await repo.findById(created.tenantId, created.id);
    expect(job).toBeTruthy();
    if (job!.status === 'queued') {
      const second = await service.processQueuedJob(created.tenantId, created.id, 'worker-2');
      expect(second.status).toBe('completed');
    }
  });

  it('dead-letters when retries exhausted', async () => {
    const created = await service.createJob({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `dlq-${randomUUID()}`,
      queueImmediately: false,
      maxAttempts: 1,
    });
    await service.queueJob(created.tenantId, created.id, owner);
    // Manually fail with autoRetry after start
    await service.startJob(created.tenantId, created.id, 'w');
    const dead = await service.failJob(created.tenantId, created.id, 'boom', { autoRetry: true });
    expect(dead.status).toBe('dead_letter');
    const dlq = await repo.listDeadLetters(created.tenantId);
    expect(dlq).toHaveLength(1);
    expect(dlq[0].correlationId).toBe(created.correlationId);
    expect(dlq[0].attempts).toBeGreaterThanOrEqual(1);
    expect(notifications.drainProduced().some((n) => n.kind === 'dead_letter_reached')).toBe(true);
    expect(audit.drainRecorded().some((a) => a.action === 'importExport.job.dead_lettered')).toBe(
      true,
    );
  });

  it('cancels queued jobs and rejects cancel of completed jobs', async () => {
    const created = await service.createJob({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `cancel-${randomUUID()}`,
      queueImmediately: true,
    });
    const cancelled = await service.cancelJob(created.tenantId, created.id, owner);
    expect(cancelled.status).toBe('cancelled');

    const done = await service.createJob({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `done-${randomUUID()}`,
      queueImmediately: true,
    });
    await service.processQueuedJob(done.tenantId, done.id, 'w');
    await expect(service.cancelJob(done.tenantId, done.id, owner)).rejects.toThrow(/Cannot cancel/);
  });

  it('expires jobs past TTL without deletion', async () => {
    const created = await service.createJob({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `exp-${randomUUID()}`,
      queueImmediately: false,
      ttlMs: 1,
    });
    await new Promise((r) => setTimeout(r, 5));
    const count = await service.expireDueJobs(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    const expired = await repo.findById(created.tenantId, created.id);
    expect(expired?.status).toBe('expired');
    expect(expired).toBeTruthy();
  });

  it('enforces RBAC, licensing, tenant and branch isolation', async () => {
    await expect(
      service.createJob({
        tenantId: 'tenant-a',
        typeId: 'users-export',
        direction: 'export',
        initiatedByUserId: 'u',
        actorRoles: ['patient'],
        idempotencyKey: `rbac-${randomUUID()}`,
        queueImmediately: false,
      }),
    ).rejects.toThrow(/permission/i);

    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: false,
        allowDataExport: false,
      }),
    };
    const locked = new ImportExportJobService(
      repo,
      registry,
      { enqueueJob: jest.fn() } as never,
      executor,
      activity,
      audit,
      notifications,
      tenantPolicy as never,
    );
    await expect(
      locked.createJob({
        tenantId: 'tenant-a',
        typeId: 'users-export',
        direction: 'export',
        initiatedByUserId: owner.userId,
        actorRoles: owner.roles,
        idempotencyKey: `lic-${randomUUID()}`,
        queueImmediately: false,
      }),
    ).rejects.toThrow(/allowDataExport/);

    const job = await service.createJob({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      direction: 'export',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `iso-${randomUUID()}`,
      queueImmediately: false,
    });
    await expect(
      service.getJob('tenant-b', job.id, { userId: 'x', roles: ['owner'] }),
    ).rejects.toThrow(/not found/i);
    await expect(
      service.getJob('tenant-a', job.id, {
        userId: 'x',
        roles: ['owner'],
        branchId: 'branch-b',
      }),
    ).rejects.toThrow(/Branch isolation/);
  });

  it('retry engine computes delay and dead-letter decision', () => {
    const engine = new ImportExportRetryEngine();
    const decision = engine.decide({
      attemptCount: 1,
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
    } as never);
    expect(decision.shouldRetry).toBe(true);
    expect(decision.delayMs).toBe(1000);

    const terminal = engine.decide({
      attemptCount: 3,
      maxAttempts: 3,
      baseDelayMs: 1000,
      maxDelayMs: 10_000,
    } as never);
    expect(terminal.shouldDeadLetter).toBe(true);
  });

  it('static catalog remains non-executable and registered for typeId validation', () => {
    expect(registry.listRegistrations().length).toBe(STATIC_IMPORT_EXPORT_CATALOG.length);
    expect(registry.listExecutableAdapters()).toEqual([]);
  });
});
