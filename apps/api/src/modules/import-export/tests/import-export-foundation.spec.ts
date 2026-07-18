import {
  IMPORT_EXPORT_ACTIVITY_EVENTS,
  IMPORT_EXPORT_AUDIT_ACTIONS,
  IMPORT_EXPORT_EXTENSION_KIND,
  IMPORT_EXPORT_PERMISSION_ACTIONS,
  IMPORT_EXPORT_PERMISSION_RESOURCE,
  IMPORT_EXPORT_QUEUE_NAME,
} from '../import-export.constants';
import {
  isImportExportCenterEnabled,
  loadImportExportFoundationConfig,
} from '../config/import-export-config';
import { ImportExportExtensionRegistry } from '../application/import-export-extension.registry';
import { ImportExportRuntimeRegistry } from '../application/import-export-runtime.registry';
import { EffectiveImportExportViewService } from '../application/effective-import-export-view.service';
import { ImportExportActivityContracts } from '../application/import-export-activity.contracts';
import { ImportExportAuditContracts } from '../application/import-export-audit.contracts';
import { ImportExportQueueService } from '../infrastructure/import-export-queue.service';
import { ImportExportWorkerService } from '../infrastructure/import-export-worker.service';
import { ImportExportHealthController } from '../controllers/import-export-health.controller';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';

describe('Phase 42a — Import/Export Center foundation', () => {
  const previousFlag = process.env.IMPORT_EXPORT_CENTER_ENABLED;
  const previousWorkers = process.env.BACKGROUND_WORKERS_ENABLED;
  const previousNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    if (previousFlag === undefined) delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    else process.env.IMPORT_EXPORT_CENTER_ENABLED = previousFlag;
    if (previousWorkers === undefined) delete process.env.BACKGROUND_WORKERS_ENABLED;
    else process.env.BACKGROUND_WORKERS_ENABLED = previousWorkers;
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
  });

  it('defaults feature flag OFF and loads dormant config', () => {
    delete process.env.IMPORT_EXPORT_CENTER_ENABLED;
    expect(isImportExportCenterEnabled()).toBe(false);
    const config = loadImportExportFoundationConfig();
    expect(config.featureEnabled).toBe(false);
    expect(config.queueName).toBe(IMPORT_EXPORT_QUEUE_NAME);
    expect(config.extensionKind).toBe(IMPORT_EXPORT_EXTENSION_KIND);
  });

  it('registers importExport extension kind locally (no adapters)', () => {
    const registry = new ImportExportExtensionRegistry();
    expect(registry.getExtensionKind()).toBe('importExport');
    expect(registry.isRegistered()).toBe(true);
    expect(registry.listAdapterRegistrations()).toEqual([]);
  });

  it('EffectiveImportExportView returns empty visible catalog when dormant', async () => {
    const tenantPolicy = {
      getAdvancedPolicy: jest.fn().mockResolvedValue({
        allowDataImport: true,
        allowDataExport: true,
      }),
    };
    const runtime = new ImportExportRuntimeRegistry();
    const view = new EffectiveImportExportViewService(
      new ImportExportExtensionRegistry(),
      runtime,
      tenantPolicy as never,
    );
    const result = await view.resolve({
      tenantId: 'tenant-a',
      branchId: 'branch-a',
      roles: ['owner'],
      hasReadPermission: true,
    });
    expect(result.types).toEqual([]);
    expect(result.extensionKind).toBe('importExport');
    expect(result.allowDataImport).toBe(true);
    expect(result.allowDataExport).toBe(true);
    expect(result.tenantId).toBe('tenant-a');
    expect(result.branchId).toBe('branch-a');
    expect(result.featureEnabled).toBe(false);
    expect(result.visible).toBe(false);
    expect(result.meta.executableCount).toBe(0);
    expect(tenantPolicy.getAdvancedPolicy).toHaveBeenCalledWith('tenant-a');
  });

  it('registers permission definitions against runtime matrix', () => {
    expect(IMPORT_EXPORT_PERMISSION_RESOURCE).toBe('api.importExport');
    expect(IMPORT_EXPORT_PERMISSION_ACTIONS).toEqual({
      read: 'view',
      create: 'create',
      manage: 'manage',
      download: 'export',
    });
    expect(rolesCanAccessResource(['owner'], 'api.importExport', 'view')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.importExport', 'create')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.importExport', 'manage')).toBe(true);
    expect(rolesCanAccessResource(['owner'], 'api.importExport', 'export')).toBe(true);
    expect(rolesCanAccessResource(['patient'], 'api.importExport', 'manage')).toBe(false);
  });

  it('registers queue name and exposes enqueue API for Phase 42c', () => {
    expect(IMPORT_EXPORT_QUEUE_NAME).toBe('import-export');
    const bullMq = { connection: {} };
    const metrics = {
      recordEnqueued: jest.fn(),
      recordCompleted: jest.fn(),
      recordFailed: jest.fn(),
    };
    const service = new ImportExportQueueService(bullMq as never, metrics as never);
    expect(service.queueName).toBe('import-export');
    expect(typeof service.enqueueJob).toBe('function');
  });

  it('worker shell initializes disabled when flag OFF and processes zero jobs', () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'false';
    process.env.NODE_ENV = 'development';
    delete process.env.BACKGROUND_WORKERS_ENABLED;

    const worker = new ImportExportWorkerService(
      { connection: {} } as never,
      { processQueuedJob: jest.fn() } as never,
    );
    worker.onModuleInit();
    const health = worker.getHealth();
    expect(health.status).toBe('disabled');
    expect(health.featureEnabled).toBe(false);
    expect(health.jobsProcessed).toBe(0);
    expect(health.queue).toBe('import-export');
    expect(health.disableReason).toContain('IMPORT_EXPORT_CENTER_ENABLED=false');
  });

  it('health endpoint reports ready / dormant foundation state', async () => {
    process.env.IMPORT_EXPORT_CENTER_ENABLED = 'false';
    const registry = new ImportExportExtensionRegistry();
    const runtime = new ImportExportRuntimeRegistry();
    const view = new EffectiveImportExportViewService(registry, runtime, {
      getAdvancedPolicy: async () => ({
        allowDataImport: true,
        allowDataExport: true,
      }),
    } as never);
    const queue = {
      queueName: IMPORT_EXPORT_QUEUE_NAME,
      isConnected: () => true,
      getEnqueuedCount: () => 0,
    };
    const worker = {
      getHealth: () => ({
        status: 'disabled' as const,
        ready: false,
        queue: IMPORT_EXPORT_QUEUE_NAME,
        jobsProcessed: 0,
        featureEnabled: false,
        disableReason: 'IMPORT_EXPORT_CENTER_ENABLED=false',
        workerId: 'test',
        processor: 'process-import-export-job',
      }),
    };
    const jobService = {
      getEngineHealth: async () => ({ jobsByStatus: {}, nullExecutorExecutions: 0, queueJobName: 'x' }),
    };
    const nullExecutor = { getExecutionCount: () => 0 };
    const expirationScheduler = { getRunCount: () => 0 };
    const artifactCleanup = {
      getRunCount: () => 0,
      getLastMetrics: () => ({ expired: 0, deleted: 0 }),
    };
    const controller = new ImportExportHealthController(
      queue as never,
      worker as never,
      registry,
      runtime,
      view,
      jobService as never,
      nullExecutor as never,
      expirationScheduler as never,
      artifactCleanup as never,
    );
    const health = await controller.health();
    expect(health.ready).toBe(true);
    expect(health.dormant).toBe(true);
    expect(health.featureFlag.enabled).toBe(false);
    expect(health.queue.name).toBe('import-export');
    expect(health.worker.jobsProcessed).toBe(0);
    expect(health.effectiveView.types).toBe(0);
    expect(health.extensionKind.adapters).toBe(0);
    expect(health.registry.executableCount).toBe(0);
    expect(health.executor.name).toBe('NullImportExportExecutor');
  });

  it('registers activity and audit contract names only (no emit surface)', () => {
    const activity = new ImportExportActivityContracts();
    const audit = new ImportExportAuditContracts();
    expect(activity.listEventNames()).toEqual([...IMPORT_EXPORT_ACTIVITY_EVENTS]);
    expect(audit.listActionNames()).toEqual([...IMPORT_EXPORT_AUDIT_ACTIONS]);
    expect(typeof (activity as { emit?: unknown }).emit).toBe('undefined');
    expect(typeof (audit as { emit?: unknown }).emit).toBe('undefined');
  });
});
