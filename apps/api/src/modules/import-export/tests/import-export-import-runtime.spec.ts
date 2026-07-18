import { randomUUID } from 'crypto';
import { ImportAdapterResolver } from '../application/import-adapter.resolver';
import { ImportExportRuntimeRegistry } from '../application/import-export-runtime.registry';
import { ImportFileIntakeService, MalwareDetectedError } from '../application/import-file-intake.service';
import { ImportRuntimeService } from '../application/import-runtime.service';
import { ImportExportJobService } from '../application/import-export-job.service';
import { ImportExportActivityEmitterService } from '../application/import-export-activity.emitter';
import { ImportExportNotificationIntentService } from '../application/import-export-notification-intent.service';
import { NullImportExportExecutor } from '../application/null-import-export.executor';
import { InMemoryImportExportJobRepository } from '../infrastructure/in-memory-import-export-job.repository';
import { ImportTempStorageService } from '../infrastructure/import-temp-storage.service';
import { ImportExportExpirationScheduler } from '../infrastructure/import-export-expiration.scheduler';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import { UsersImportAdapter } from '../adapters/users-import.adapter';
import { ImportAdapterResolutionError } from '../domain/import/import-adapter.contracts';
import type { VirusScannerPort } from '../../media/infrastructure/virus-scan/virus-scanner.port';

describe('Phase 42d — Import Runtime', () => {
  const previousFlag = process.env.IMPORT_EXPORT_CENTER_ENABLED;
  let registry: ImportExportRuntimeRegistry;
  let resolver: ImportAdapterResolver;
  let repo: InMemoryImportExportJobRepository;
  let jobService: ImportExportJobService;
  let runtime: ImportRuntimeService;
  let notifications: ImportExportNotificationIntentService;
  let activity: ImportExportActivityEmitterService;
  let audit: ImportExportAuditLog;
  let virus: { scan: jest.Mock };
  let usersSaved: Array<{ email: string; tenantId: string }>;

  const owner = { userId: 'user-1', roles: ['owner'], branchId: 'branch-a' };

  beforeEach(() => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'true';
    usersSaved = [];
    registry = new ImportExportRuntimeRegistry();
    registry.loadStaticCatalog();
    resolver = new ImportAdapterResolver(registry);
    repo = new InMemoryImportExportJobRepository();
    activity = new ImportExportActivityEmitterService({
      recordEnqueued: jest.fn(),
      recordCompleted: jest.fn(),
      recordFailed: jest.fn(),
    } as never);
    audit = new ImportExportAuditLog({ save: jest.fn().mockResolvedValue(undefined) } as never);
    notifications = new ImportExportNotificationIntentService({
      produceInApp: jest.fn().mockResolvedValue({ intentId: 'n1' }),
    } as never);

    const usersAdapter = new UsersImportAdapter(
      {
        findByEmail: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation(async (user: { email: string; tenantId: string }) => {
          usersSaved.push({ email: user.email, tenantId: user.tenantId });
        }),
      } as never,
      { publish: jest.fn() } as never,
      {
        enforceUserLimit: jest.fn(),
        enforceDoctorLimit: jest.fn(),
      } as never,
    );
    registry.attachImportAdapter(usersAdapter);

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

    virus = {
      scan: jest.fn().mockResolvedValue({ status: 'clean', scannerName: 'test-scanner' }),
    };
    const intake = new ImportFileIntakeService(virus as unknown as VirusScannerPort);
    const storage = new ImportTempStorageService();

    runtime = new ImportRuntimeService(
      jobService,
      repo,
      registry,
      resolver,
      intake,
      storage,
      usersAdapter,
      tenantPolicy as never,
      activity,
      audit,
      notifications,
    );
    // Avoid double-attach in onModuleInit during unit tests
  });

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    else process.env.IMPORT_EXPORT_CENTER_ENABLED = previousFlag;
  });

  it('resolves attached users-import adapter and rejects missing/disabled', () => {
    const adapter = resolver.resolve({
      typeId: 'users-import',
      tenantId: 'tenant-a',
      roles: ['owner'],
      allowDataImport: true,
    });
    expect(adapter.typeId).toBe('users-import');

    expect(() =>
      resolver.resolve({
        typeId: 'inventory-import',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataImport: true,
      }),
    ).toThrow(ImportAdapterResolutionError);

    expect(() =>
      resolver.resolve({
        typeId: 'users-import',
        tenantId: 'tenant-a',
        roles: ['owner'],
        allowDataImport: false,
      }),
    ).toThrow(/license_mismatch|allowDataImport/);
  });

  it('rejects unsupported formats', () => {
    const intake = new ImportFileIntakeService(virus as unknown as VirusScannerPort);
    expect(() => intake.detectFormat('notes.pdf')).toThrow(/CSV and XLSX/);
  });

  it('fails malware infected uploads', async () => {
    virus.scan.mockResolvedValue({
      status: 'infected',
      scannerName: 'test',
      details: 'eicar',
    });
    const job = await runtime.createImport({
      tenantId: 'tenant-a',
      typeId: 'users-import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `m-${randomUUID()}`,
      dryRun: true,
    });
    await expect(
      runtime.uploadFile({
        tenantId: 'tenant-a',
        jobId: job.id,
        actor: owner,
        file: {
          buffer: Buffer.from('bad'),
          originalname: 'users.csv',
          mimetype: 'text/csv',
        },
        queueAfterUpload: false,
      }),
    ).rejects.toThrow(MalwareDetectedError);
  });

  it('dry run validates and writes no users', async () => {
    const job = await runtime.createImport({
      tenantId: 'tenant-a',
      typeId: 'users-import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `dry-${randomUUID()}`,
      dryRun: true,
    });
    const csv = Buffer.from('email,firstName,lastName\na@b.com,Ada,Lovelace\n', 'utf8');
    await runtime.uploadFile({
      tenantId: 'tenant-a',
      jobId: job.id,
      actor: owner,
      file: { buffer: csv, originalname: 'users.csv', mimetype: 'text/csv' },
      queueAfterUpload: false,
    });
    const queued = await jobService.queueJob('tenant-a', job.id, owner);
    const started = await jobService.startJob('tenant-a', queued.id, 'worker-1');
    const completed = await runtime.executeImportJob(started, 'worker-1');
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
    expect(usersSaved).toHaveLength(0);
    expect(completed.metadata.importSummary).toMatchObject({ dryRun: true });
    expect(runtime.getProgress(completed).stage).toBe('completed');
  });

  it('real import persists users through adapter', async () => {
    const job = await runtime.createImport({
      tenantId: 'tenant-a',
      typeId: 'users-import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `real-${randomUUID()}`,
      dryRun: false,
    });
    const csv = Buffer.from('email,firstName,lastName\nreal@b.com,Grace,Hopper\n', 'utf8');
    await runtime.uploadFile({
      tenantId: 'tenant-a',
      jobId: job.id,
      actor: owner,
      file: { buffer: csv, originalname: 'users.csv', mimetype: 'text/csv' },
      queueAfterUpload: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    const started = await jobService.startJob('tenant-a', job.id, 'w');
    // executeImportJob expects already started or will start via processQueuedJob;
    // call execute on running job by resetting status for unit path:
    const running = await repo.update({ ...started, status: 'running' });
    const completed = await runtime.executeImportJob(running, 'worker-1');
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
    expect(usersSaved.length).toBeGreaterThanOrEqual(1);
    expect(notifications.drainProduced().some((n) => n.kind === 'import_completed')).toBe(true);
  });

  it('notification failure does not fail import', async () => {
    const failingNotify = new ImportExportNotificationIntentService({
      produceInApp: jest.fn().mockRejectedValue(new Error('notify down')),
    } as never);
    (runtime as unknown as { notifications: ImportExportNotificationIntentService }).notifications =
      failingNotify;

    const job = await runtime.createImport({
      tenantId: 'tenant-a',
      typeId: 'users-import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `nf-${randomUUID()}`,
      dryRun: true,
    });
    const csv = Buffer.from('email,firstName,lastName\nnf@b.com,Alan,Turing\n', 'utf8');
    await runtime.uploadFile({
      tenantId: 'tenant-a',
      jobId: job.id,
      actor: owner,
      file: { buffer: csv, originalname: 'users.csv', mimetype: 'text/csv' },
      queueAfterUpload: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    const started = await jobService.startJob('tenant-a', job.id, 'w');
    const completed = await runtime.executeImportJob(
      await repo.update({ ...started, status: 'running' }),
      'w',
    );
    expect(['completed', 'completed_with_warnings']).toContain(completed.status);
  });

  it('automatic expiration scheduler expires due jobs', async () => {
    const scheduler = new ImportExportExpirationScheduler(jobService);
    const job = await jobService.createJob({
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
    const count = await scheduler.runOnce(new Date());
    expect(count).toBeGreaterThanOrEqual(1);
    expect((await repo.findById('tenant-a', job.id))?.status).toBe('expired');
  });

  it('validation failure fails job without persistence', async () => {
    const job = await runtime.createImport({
      tenantId: 'tenant-a',
      typeId: 'users-import',
      initiatedByUserId: owner.userId,
      actorRoles: owner.roles,
      idempotencyKey: `val-${randomUUID()}`,
      dryRun: false,
    });
    const csv = Buffer.from('email,firstName,lastName\nnot-an-email,A,B\n', 'utf8');
    await runtime.uploadFile({
      tenantId: 'tenant-a',
      jobId: job.id,
      actor: owner,
      file: { buffer: csv, originalname: 'users.csv', mimetype: 'text/csv' },
      queueAfterUpload: false,
    });
    await jobService.queueJob('tenant-a', job.id, owner);
    const started = await jobService.startJob('tenant-a', job.id, 'w');
    const failed = await runtime.executeImportJob(
      await repo.update({ ...started, status: 'running' }),
      'w',
    );
    expect(failed.status).toBe('failed');
    expect(usersSaved).toHaveLength(0);
  });
});
