import { Inject, Injectable, Logger, OnModuleInit, forwardRef } from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import {
  UsersImportAdapter,
  parseImportRows,
} from '../adapters/users-import.adapter';
import type {
  ImportFileFormat,
  ImportProgress,
  ImportProgressStage,
  ImportResult,
} from '../domain/import/import-adapter.contracts';
import type { ImportExportJob, JobMetadata } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import { ImportAdapterResolver } from './import-adapter.resolver';
import { ImportExportActivityEmitterService } from './import-export-activity.emitter';
import { ImportExportJobService } from './import-export-job.service';
import { ImportExportNotificationIntentService } from './import-export-notification-intent.service';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';
import {
  ImportFileIntakeService,
  MalwareDetectedError,
} from './import-file-intake.service';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import { ImportTempStorageService } from '../infrastructure/import-temp-storage.service';
import {
  IMPORT_EXPORT_JOB_REPOSITORY,
  type ImportExportJobRepository,
} from './ports/import-export-job.repository';

export interface CreateImportSessionInput {
  tenantId: string;
  branchId?: string | null;
  typeId: string;
  initiatedByUserId: string;
  actorRoles: string[];
  idempotencyKey: string;
  correlationId?: string;
  dryRun?: boolean;
}

/**
 * Phase 42d — Import Runtime orchestrator.
 */
@Injectable()
export class ImportRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(ImportRuntimeService.name);

  constructor(
    @Inject(forwardRef(() => ImportExportJobService))
    private readonly jobs: ImportExportJobService,
    @Inject(IMPORT_EXPORT_JOB_REPOSITORY) private readonly jobRepo: ImportExportJobRepository,
    private readonly registry: ImportExportRuntimeRegistry,
    private readonly resolver: ImportAdapterResolver,
    private readonly intake: ImportFileIntakeService,
    private readonly storage: ImportTempStorageService,
    private readonly usersAdapter: UsersImportAdapter,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly activity: ImportExportActivityEmitterService,
    private readonly audit: ImportExportAuditLog,
    private readonly notifications: ImportExportNotificationIntentService,
  ) {}

  onModuleInit(): void {
    this.registry.loadStaticCatalog();
    this.registry.attachImportAdapter(this.usersAdapter);
  }

  async createImport(input: CreateImportSessionInput): Promise<ImportExportJob> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(input.tenantId);
    this.resolver.resolve({
      typeId: input.typeId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      roles: input.actorRoles,
      allowDataImport: policy.allowDataImport,
    });

    return this.jobs.createJob({
      tenantId: input.tenantId,
      branchId: input.branchId,
      typeId: input.typeId,
      direction: 'import',
      initiatedByUserId: input.initiatedByUserId,
      actorRoles: input.actorRoles,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      queueImmediately: false,
      metadata: {
        source: 'api',
        runtime: 'import',
        dryRun: Boolean(input.dryRun),
        progress: progressPayload('queued', 0, 'Import session created'),
      },
    });
  }

  async uploadFile(params: {
    tenantId: string;
    jobId: string;
    actor: { userId: string; roles: string[]; branchId?: string | null };
    file: { buffer: Buffer; originalname: string; mimetype: string };
    queueAfterUpload?: boolean;
  }): Promise<ImportExportJob> {
    let job = await this.jobs.getJob(params.tenantId, params.jobId, params.actor);
    if (job.direction !== 'import') {
      throw new Error('Upload is only supported for import jobs');
    }

    const format = this.intake.detectFormat(params.file.originalname, params.file.mimetype);
    job = await this.patchProgress(job, 'uploading', 10, 'Receiving file');

    try {
      job = await this.patchProgress(job, 'scanning', 25, 'Malware scan');
      const scan = await this.intake.scanOrFail({
        buffer: params.file.buffer,
        filename: params.file.originalname,
        mimeType: params.file.mimetype,
        tenantId: params.tenantId,
      });

      const stored = await this.storage.saveUpload({
        tenantId: params.tenantId,
        jobId: job.id,
        filename: params.file.originalname,
        buffer: params.file.buffer,
      });

      job = await this.jobRepo.update({
        ...job,
        metadata: {
          ...job.metadata,
          format,
          filename: params.file.originalname,
          mimeType: params.file.mimetype,
          storagePath: stored.absolutePath,
          storageKey: stored.relativeKey,
          bytes: stored.bytes,
          scannerName: scan.scannerName,
          progress: progressPayload('scanning', 40, 'Scan clean; file stored'),
        },
      });

      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'importExport.import.file_uploaded',
        jobId: job.id,
        actorId: params.actor.userId,
        actorRoles: params.actor.roles,
        correlationId: job.correlationId,
        details: {
          filename: params.file.originalname,
          format,
          dryRun: String(Boolean(job.metadata.dryRun)),
          bytes: String(stored.bytes),
        },
      });

      if (params.queueAfterUpload !== false) {
        job = await this.jobs.queueJob(params.tenantId, job.id, params.actor);
      }
      return job;
    } catch (error) {
      if (error instanceof MalwareDetectedError) {
        await this.failImport(job, error.message, params.actor);
        throw error;
      }
      throw error;
    }
  }

  getProgress(job: ImportExportJob): ImportProgress {
    const raw = job.metadata.progress as ImportProgress | undefined;
    if (raw?.stage) return raw;
    return progressPayload('queued', 0);
  }

  /**
   * Worker path for import jobs — validation + adapter execute.
   */
  async executeImportJob(job: ImportExportJob, workerId: string): Promise<ImportExportJob> {
    const dryRun = Boolean(job.metadata.dryRun);
    const format = job.metadata.format as ImportFileFormat | undefined;
    const storagePath = job.metadata.storagePath as string | undefined;
    if (!format || !storagePath) {
      return this.jobs.failJob(job.tenantId, job.id, 'missing_upload', { autoRetry: false });
    }

    await this.safeActivity('import_started', job);
    let current = await this.patchProgress(job, 'validating', 55, 'Validating');

    try {
      const policy = await this.tenantPolicy.getAdvancedPolicy(job.tenantId);
      const adapter = this.resolver.resolve({
        typeId: job.typeId,
        tenantId: job.tenantId,
        branchId: job.branchId,
        roles: ['owner'], // worker uses system path after create-time RBAC
        allowDataImport: policy.allowDataImport,
        format,
      });

      await this.safeActivity('validation_started', current);
      const buffer = await this.storage.read(storagePath);
      const rows = await parseImportRows(format, buffer);
      const context = {
        jobId: current.id,
        tenantId: current.tenantId,
        branchId: current.branchId,
        typeId: current.typeId,
        correlationId: current.correlationId,
        initiatedByUserId: current.initiatedByUserId,
        dryRun,
        format,
        filename: String(current.metadata.filename ?? 'upload'),
        rows,
        roles: [],
      };

      const validation = await adapter.validate(context);
      await this.safeActivity('validation_completed', current, {
        reason: validation.valid ? 'valid' : 'invalid',
      });

      if (!validation.valid) {
        current = await this.patchProgress(current, 'failed', 100, 'Validation failed');
        await this.safeActivity('import_failed', current, { reason: 'validation_failed' });
        await this.safeNotify('job_failed', current);
        return this.jobs.failJob(current.tenantId, current.id, 'validation_failed', {
          autoRetry: false,
        });
      }

      current = await this.patchProgress(current, 'importing', 75, dryRun ? 'Dry run' : 'Importing');
      const result: ImportResult = await adapter.execute(context);

      current = await this.patchProgress(current, 'finalizing', 90, 'Finalizing');
      await this.audit.record({
        tenantId: current.tenantId,
        branchId: current.branchId,
        action: dryRun ? 'importExport.import.dry_run_completed' : 'importExport.import.completed',
        jobId: current.id,
        actorId: current.initiatedByUserId,
        actorRoles: ['system'],
        correlationId: current.correlationId,
        details: {
          adapter: adapter.typeId,
          filename: String(current.metadata.filename ?? ''),
          dryRun: String(dryRun),
          created: String(result.summary.created),
          failed: String(result.summary.failed),
          workerId,
        },
      });

      if (!result.success) {
        current = await this.patchProgress(current, 'failed', 100, result.error ?? 'import_failed');
        await this.safeActivity('import_failed', current, { reason: result.error });
        await this.safeNotify('job_failed', current);
        return this.jobs.failJob(current.tenantId, current.id, result.error ?? 'import_failed', {
          autoRetry: false,
        });
      }

      current = await this.jobRepo.update({
        ...current,
        warningCount: result.warnings.length,
        metadata: {
          ...current.metadata,
          importSummary: result.summary,
          progress: progressPayload('completed', 100, 'Import completed'),
        },
      });

      await this.safeActivity('import_completed', current);
      await this.safeNotify('import_completed', current);

      return this.jobs.completeJob(current.tenantId, current.id, {
        withWarnings: result.warnings.length > 0 || result.summary.failed > 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'import_runtime_error';
      await this.safeActivity('import_failed', job, { reason: message });
      await this.safeNotify('job_failed', job);
      return this.jobs.failJob(job.tenantId, job.id, message, { autoRetry: true });
    }
  }

  private async failImport(
    job: ImportExportJob,
    reason: string,
    actor: { userId: string; roles: string[] },
  ): Promise<void> {
    await this.patchProgress(job, 'failed', 100, reason);
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.import.malware_rejected',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      reason,
    });
    await this.jobs.failJob(job.tenantId, job.id, reason, { autoRetry: false });
  }

  private async patchProgress(
    job: ImportExportJob,
    stage: ImportProgressStage,
    percent: number,
    message?: string,
  ): Promise<ImportExportJob> {
    const metadata: JobMetadata = {
      ...job.metadata,
      progress: progressPayload(stage, percent, message),
    };
    return this.jobRepo.update({ ...job, metadata });
  }

  private async safeActivity(
    event:
      | 'import_started'
      | 'validation_started'
      | 'validation_completed'
      | 'import_completed'
      | 'import_failed'
      | 'import_cancelled',
    job: ImportExportJob,
    extra?: { reason?: string },
  ): Promise<void> {
    try {
      // Map to existing emitter events where needed
      const mapped =
        event === 'import_started'
          ? 'job_started'
          : event === 'import_completed'
            ? 'job_completed'
            : event === 'import_failed'
              ? 'job_failed'
              : event === 'import_cancelled'
                ? 'job_cancelled'
                : 'job_queued';
      await this.activity.emit(mapped as 'job_started', {
        tenantId: job.tenantId,
        branchId: job.branchId,
        jobId: job.id,
        typeId: job.typeId,
        direction: job.direction,
        status: job.status,
        correlationId: job.correlationId,
        reason: extra?.reason ?? event,
      });
      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'import_runtime',
          event,
          jobId: job.id,
          correlationId: job.correlationId,
        }),
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'import_runtime',
          event: 'activity_emit_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /** Notification failures must never fail imports. */
  private async safeNotify(
    kind: 'import_completed' | 'job_failed',
    job: ImportExportJob,
  ): Promise<void> {
    try {
      await this.notifications.notify(kind, job);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'import_runtime',
          event: 'notification_failed_non_blocking',
          jobId: job.id,
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      try {
        await this.activity.emit('job_failed', {
          tenantId: job.tenantId,
          jobId: job.id,
          correlationId: job.correlationId,
          reason: 'notification_intent_failed',
        });
        await this.audit.record({
          tenantId: job.tenantId,
          branchId: job.branchId,
          action: 'importExport.import.notification_failed',
          jobId: job.id,
          actorId: 'system',
          actorRoles: ['system'],
          correlationId: job.correlationId,
          reason: error instanceof Error ? error.message : String(error),
        });
      } catch {
        /* swallow */
      }
    }
  }
}

function progressPayload(
  stage: ImportProgressStage,
  percent: number,
  message?: string,
): ImportProgress {
  return {
    stage,
    percent,
    message,
    updatedAt: new Date().toISOString(),
  };
}
