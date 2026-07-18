import { createHash, randomUUID } from 'crypto';
import { ExportAdapterResolver } from '../application/export-adapter.resolver';
import { ExportRuntimeService } from '../application/export-runtime.service';
import { ImportExportRuntimeRegistry } from '../application/import-export-runtime.registry';
import { ImportExportJobService } from '../application/import-export-job.service';
import { ImportExportActivityEmitterService } from '../application/import-export-activity.emitter';
import { ImportExportNotificationIntentService } from '../application/import-export-notification-intent.service';
import { NullImportExportExecutor } from '../application/null-import-export.executor';
import { InMemoryImportExportJobRepository } from '../infrastructure/in-memory-import-export-job.repository';
import { InMemoryExportArtifactRepository } from '../infrastructure/in-memory-export-artifact.repository';
import { LocalArtifactStorageProvider } from '../infrastructure/local-artifact-storage.provider';
import { ExportArtifactCleanupScheduler } from '../infrastructure/export-artifact-cleanup.scheduler';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import { UsersExportAdapter } from '../adapters/users-export.adapter';
import { ExportAdapterResolutionError } from '../domain/export/export-adapter.contracts';
import type { ArtifactStoragePort } from '../application/ports/artifact-storage.port';
import * as path from 'path';
import * as os from 'os';
import { promises as fs } from 'fs';

describe('Phase 42e — Export Runtime', () => {
  const previousFlag = process.env.IMPORT_EXPORT_CENTER_ENABLED;
  const previousArtifactPath = process.env.IMPORT_EXPORT_ARTIFACT_PATH;
  let registry: ImportExportRuntimeRegistry;
  let resolver: ExportAdapterResolver;
  let repo: InMemoryImportExportJobRepository;
  let artifactRepo: InMemoryExportArtifactRepository;
  let storage: ArtifactStoragePort;
  let jobService: ImportExportJobService;
  let runtime: ExportRuntimeService;
  let notifications: ImportExportNotificationIntentService;
  let activity: ImportExportActivityEmitterService;
  let audit: ImportExportAuditLog;
  let tmpRoot: string;

  const owner = { userId: 'user-1', roles: ['owner'], branchId: 'branch-a' };

  beforeEach(async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'ie-export-'));
    process.env.IMPORT_EXPORT_ARTIFACT_PATH = tmpRoot;

    registry = new ImportExportRuntimeRegistry();
    registry.loadStaticCatalog();
    resolver = new ExportAdapterResolver(registry);
    repo = new InMemoryImportExportJobRepository();
    artifactRepo = new InMemoryExportArtifactRepository();
    storage = new LocalArtifactStorageProvider();

    activity = new ImportExportActivityEmitterService({
      recordEnqueued: jest.fn(),
      recordCompleted: jest.fn(),
      recordFailed: jest.fn(),
    } as never);
    audit = new ImportExportAuditLog({ save: jest.fn().mockResolvedValue(undefined) } as never);
    notifications = new ImportExportNotificationIntentService({
      produceInApp: jest.fn().mockResolvedValue({ intentId: 'n1' }),
    } as never);

    const usersAdapter = new UsersExportAdapter({
      list: jest.fn().mockResolvedValue({
        items: [
          {
            email: 'ada@example.com',
            firstName: 'Ada',
            lastName: 'Lovelace',
            roles: ['doctor'],
            branchId: 'branch-a',
            isActive: true,
            employmentStatus: 'active',
          },
        ],
        total: 1,
        page: 1,
        limit: 200,
      }),
    } as never);
    registry.attachExportAdapter(usersAdapter);

    const queue = { enqueueJob: jest.fn().mockResolvedValue('bull-1') };
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: true,
        allowDataExport: true,
      }),
    };
    jobService = new ImportExportJobService(
      repo,
      registry,
      queue as never,
      new NullImportExportExecutor(),
      activity,
      audit,
      notifications,
      tenantPolicy as never,
    );

    runtime = new ExportRuntimeService(
      jobService,
      repo,
      artifactRepo,
      storage,
      registry,
      resolver,
      usersAdapter,
      tenantPolicy as never,
      activity,
      audit,
      notifications,
    );
    (jobService as unknown as { exportRuntime: ExportRuntimeService }).exportRuntime = runtime;
  });

  afterEach(async () => {
    if (previousFlag === undefined) delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    else process.env.IMPORT_EXPORT_CENTER_ENABLED = previousFlag;
    if (previousArtifactPath === undefined) delete process.env.IMPORT_EXPORT_ARTIFACT_PATH;
    else process.env.IMPORT_EXPORT_ARTIFACT_PATH = previousArtifactPath;
    try {
      await fs.rm(tmpRoot, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  });

  it('resolves attached users-export adapter', () => {
    const adapter = resolver.resolve({
      typeId: 'users-export',
      tenantId: 'tenant-a',
      roles: ['owner'],
      allowDataExport: true,
      format: 'csv',
    });
    expect(adapter.typeId).toBe('users-export');
  });

  it('rejects missing adapter', () => {
    expect(() =>
      resolver.resolve({
        typeId: 'does-not-exist',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataExport: true,
      }),
    ).toThrow(ExportAdapterResolutionError);
  });

  it('rejects disabled adapter without attachment activation', () => {
    expect(() =>
      resolver.resolve({
        typeId: 'inventory-export',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataExport: true,
      }),
    ).toThrow(ExportAdapterResolutionError);
    try {
      resolver.resolve({
        typeId: 'inventory-export',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataExport: true,
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ExportAdapterResolutionError);
      expect((error as ExportAdapterResolutionError).code).toBe('disabled_adapter');
    }
  });

  it('rejects license / permission / format mismatches', () => {
    expect(() =>
      resolver.resolve({
        typeId: 'users-export',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataExport: false,
      }),
    ).toThrow(/license_mismatch|allowDataExport/);

    try {
      resolver.resolve({
        typeId: 'users-export',
        tenantId: 'tenant-a',
        roles: ['guest'],
        allowDataExport: true,
      });
      fail('expected permission mismatch');
    } catch (error) {
      expect(error).toBeInstanceOf(ExportAdapterResolutionError);
      expect((error as ExportAdapterResolutionError).code).toBe('permission_mismatch');
    }

    expect(() =>
      resolver.resolve({
        typeId: 'users-export',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataExport: true,
        format: 'pdf' as never,
      }),
    ).toThrow(/format_unsupported|not supported/);
  });

  it('storage abstraction stores and reads without exposing hub FS coupling', async () => {
    const put = await storage.put({
      storageKey: 'tenant-a/job-1/csv',
      buffer: Buffer.from('a,b\n1,2\n'),
      contentType: 'text/csv',
    });
    expect(put.checksum).toBe(createHash('sha256').update('a,b\n1,2\n').digest('hex'));
    const bytes = await storage.get(put.storageKey);
    expect(bytes.toString('utf8')).toContain('a,b');
  });

  it('successful CSV export through queue execution', async () => {
    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `csv-${randomUUID()}`,
      queueImmediately: true,
    });
    expect(job.metadata.runtime).toBe('export');
    expect(runtime.getProgress(job).stage).toBe('queued');

    const completed = await jobService.processQueuedJob('tenant-a', job.id, 'worker-export');
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
    expect(runtime.getProgress(completed).stage).toBe('completed');

    const meta = await runtime.getArtifactMetadata('tenant-a', job.id, owner);
    expect(meta.artifact.format).toBe('csv');
    expect(meta.artifact.status).toBe('available');
    expect(meta.artifact.downloadEligible).toBe(true);
    expect(meta.downloadToken).toBeTruthy();
    expect(JSON.stringify(meta)).not.toMatch(/storage[\\/]|[A-Z]:\\/);

    const file = await runtime.downloadArtifact({
      tenantId: 'tenant-a',
      jobId: job.id,
      actor: owner,
      token: meta.downloadToken!,
    });
    expect(file.contentType).toBe('text/csv');
    expect(file.buffer.toString('utf8')).toContain('ada@example.com');

    const kinds = notifications.drainProduced().map((n) => n.kind);
    expect(kinds).toContain('artifact_available');
    expect(kinds).toContain('export_completed');
  });

  it('successful XLSX export', async () => {
    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      format: 'xlsx',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `xlsx-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    const completed = await jobService.processQueuedJob('tenant-a', job.id, 'w-xlsx');
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
    const meta = await runtime.getArtifactMetadata('tenant-a', job.id, owner);
    expect(meta.artifact.format).toBe('xlsx');
    expect(meta.artifact.contentType).toContain('spreadsheetml');
  });

  it('rejects unsupported format at create', async () => {
    await expect(
      runtime.createExport({
        tenantId: 'tenant-a',
        typeId: 'users-export',
        format: 'pdf' as never,
        initiatedByUserId: owner.userId,
        actorRoles: owner.roles,
        idempotencyKey: `pdf-${randomUUID()}`,
      }),
    ).rejects.toThrow(/Unsupported export format|format_unsupported/);
  });

  it('artifact lifecycle available → expired → deleted via cleanup', async () => {
    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `life-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    await jobService.processQueuedJob('tenant-a', job.id, 'w-life');

    const artifact = await artifactRepo.findByJobId('tenant-a', job.id);
    expect(artifact?.status).toBe('available');

    await artifactRepo.update({
      ...artifact!,
      expiresAt: new Date(Date.now() - 1000),
    });

    const scheduler = new ExportArtifactCleanupScheduler(runtime);
    const first = await scheduler.runOnce(new Date());
    expect(first.expired).toBeGreaterThanOrEqual(1);

    const mid = await artifactRepo.findByJobId('tenant-a', job.id);
    expect(mid?.status).toBe('expired');

    const second = await scheduler.runOnce(new Date());
    expect(second.deleted).toBeGreaterThanOrEqual(1);
    const gone = await artifactRepo.findByJobId('tenant-a', job.id);
    expect(gone?.status).toBe('deleted');
    expect(gone?.deletedAt).toBeTruthy();
  });

  it('notification failure does not fail export', async () => {
    const failingNotify = new ImportExportNotificationIntentService({
      produceInApp: jest.fn().mockRejectedValue(new Error('notify down')),
    } as never);
    (runtime as unknown as { notifications: ImportExportNotificationIntentService }).notifications =
      failingNotify;
    // Force safeNotify path to throw by wrapping notify
    jest.spyOn(failingNotify, 'notify').mockRejectedValue(new Error('notify explode'));

    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `nf-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    const completed = await jobService.processQueuedJob('tenant-a', job.id, 'w-nf');
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
  });

  it('enforces tenant isolation on artifact access', async () => {
    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `ten-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    await jobService.processQueuedJob('tenant-a', job.id, 'w-ten');

    await expect(
      runtime.getArtifactMetadata('tenant-b', job.id, {
        userId: 'u2',
        roles: ['owner'],
      }),
    ).rejects.toThrow();
  });

  it('enforces branch isolation on artifact access', async () => {
    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `br-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    await jobService.processQueuedJob('tenant-a', job.id, 'w-br');

    await expect(
      runtime.getArtifactMetadata('tenant-a', job.id, {
        userId: owner.userId,
        roles: owner.roles,
        branchId: 'branch-b',
      }),
    ).rejects.toThrow(/Branch isolation/);
  });

  it('rejects RBAC for create without export permission', async () => {
    await expect(
      runtime.createExport({
        tenantId: 'tenant-a',
        typeId: 'users-export',
        format: 'csv',
        initiatedByUserId: 'u-staff',
        actorRoles: ['receptionist'],
        idempotencyKey: `rbac-${randomUUID()}`,
      }),
    ).rejects.toThrow();
  });

  it('rejects licensing when allowDataExport=false', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: true,
        allowDataExport: false,
      }),
    };
    (runtime as unknown as { tenantPolicy: typeof tenantPolicy }).tenantPolicy = tenantPolicy;
    await expect(
      runtime.createExport({
        tenantId: 'tenant-a',
        typeId: 'users-export',
        format: 'csv',
        initiatedByUserId: owner.userId,
        actorRoles: owner.roles,
        idempotencyKey: `lic-${randomUUID()}`,
      }),
    ).rejects.toThrow(/license|allowDataExport/);
  });

  it('reports progress stages through execution', async () => {
    const stages: string[] = [];
    const originalUpdate = repo.update.bind(repo);
    repo.update = async (job) => {
      const progress = job.metadata.progress as { stage?: string } | undefined;
      if (progress?.stage) stages.push(progress.stage);
      return originalUpdate(job);
    };

    const job = await runtime.createExport({
      tenantId: 'tenant-a',
      typeId: 'users-export',
      format: 'csv',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `prog-${randomUUID()}`,
      queueImmediately: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    await jobService.processQueuedJob('tenant-a', job.id, 'w-prog');
    expect(stages).toEqual(
      expect.arrayContaining(['preparing', 'generating', 'uploading', 'finalizing', 'completed']),
    );
  });
});
