import { createHash, randomBytes, randomUUID } from 'crypto';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { UsersExportAdapter } from '../adapters/users-export.adapter';
import type {
  ArtifactLifecycleStatus,
  ExportArtifact,
  ExportFileFormat,
  ExportProgress,
  ExportProgressStage,
  ExportResult,
} from '../domain/export/export-adapter.contracts';
import { ExportAdapterResolutionError } from '../domain/export/export-adapter.contracts';
import type { ImportExportJob, JobMetadata } from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import { ExportAdapterResolver } from './export-adapter.resolver';
import { ImportExportActivityEmitterService } from './import-export-activity.emitter';
import { ImportExportJobService, type ActorContext } from './import-export-job.service';
import { ImportExportNotificationIntentService } from './import-export-notification-intent.service';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import {
  ARTIFACT_STORAGE,
  type ArtifactStoragePort,
} from './ports/artifact-storage.port';
import {
  EXPORT_ARTIFACT_REPOSITORY,
  type ExportArtifactRepository,
} from './ports/export-artifact.repository';
import {
  IMPORT_EXPORT_JOB_REPOSITORY,
  type ImportExportJobRepository,
} from './ports/import-export-job.repository';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';

const DEFAULT_ARTIFACT_TTL_MS = 24 * 60 * 60 * 1000;

export interface CreateExportSessionInput {
  tenantId: string;
  branchId?: string | null;
  typeId: string;
  format: ExportFileFormat;
  initiatedByUserId: string;
  actorRoles: string[];
  idempotencyKey: string;
  correlationId?: string;
  filters?: Record<string, unknown>;
  queueImmediately?: boolean;
}

export interface PublicArtifactView {
  artifactId: string;
  jobId: string;
  format: ExportFileFormat;
  size: number;
  checksum: string;
  contentType: string;
  filename: string;
  createdAt: string;
  expiresAt: string;
  status: ArtifactLifecycleStatus;
  downloadEligible: boolean;
}

/**
 * Phase 42e — Export Runtime orchestrator (no business query/transform logic).
 */
@Injectable()
export class ExportRuntimeService implements OnModuleInit {
  private readonly logger = new Logger(ExportRuntimeService.name);

  constructor(
    @Inject(forwardRef(() => ImportExportJobService))
    private readonly jobs: ImportExportJobService,
    @Inject(IMPORT_EXPORT_JOB_REPOSITORY) private readonly jobRepo: ImportExportJobRepository,
    @Inject(EXPORT_ARTIFACT_REPOSITORY) private readonly artifacts: ExportArtifactRepository,
    @Inject(ARTIFACT_STORAGE) private readonly storage: ArtifactStoragePort,
    private readonly registry: ImportExportRuntimeRegistry,
    private readonly resolver: ExportAdapterResolver,
    private readonly usersAdapter: UsersExportAdapter,
    private readonly tenantPolicy: TenantPolicyService,
    private readonly activity: ImportExportActivityEmitterService,
    private readonly audit: ImportExportAuditLog,
    private readonly notifications: ImportExportNotificationIntentService,
  ) {}

  onModuleInit(): void {
    this.registry.loadStaticCatalog();
    this.registry.attachExportAdapter(this.usersAdapter);
  }

  async createExport(input: CreateExportSessionInput): Promise<ImportExportJob> {
    const format = normalizeFormat(input.format);
    const policy = await this.tenantPolicy.getAdvancedPolicy(input.tenantId);
    this.resolver.resolve({
      typeId: input.typeId,
      tenantId: input.tenantId,
      branchId: input.branchId,
      roles: input.actorRoles,
      allowDataExport: policy.allowDataExport,
      format,
    });

    return this.jobs.createJob({
      tenantId: input.tenantId,
      branchId: input.branchId,
      typeId: input.typeId,
      direction: 'export',
      initiatedByUserId: input.initiatedByUserId,
      actorRoles: input.actorRoles,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      queueImmediately: input.queueImmediately !== false,
      metadata: {
        source: 'api',
        runtime: 'export',
        format,
        filters: input.filters ?? {},
        progress: progressPayload('queued', 0, 'Export session created'),
      },
    });
  }

  getProgress(job: ImportExportJob): ExportProgress {
    const raw = job.metadata.progress as ExportProgress | undefined;
    if (raw?.stage) return raw;
    return progressPayload('queued', 0);
  }

  async getArtifactMetadata(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
  ): Promise<{ artifact: PublicArtifactView; downloadToken?: string }> {
    const job = await this.jobs.getJob(tenantId, jobId, actor);
    this.assertExportJob(job);
    this.assertArtifactAccess(actor, job);

    const artifact = await this.artifacts.findByJobId(tenantId, jobId);
    if (!artifact) throw new NotFoundException('Artifact not found');

    const downloadEligible = this.isDownloadEligible(artifact, actor);
    let downloadToken: string | undefined;
    if (downloadEligible) {
      downloadToken = mintDownloadToken();
      await this.artifacts.update({
        ...artifact,
        downloadTokenHash: hashToken(downloadToken),
      });
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'importExport.artifact.download_token_issued',
        jobId: job.id,
        actorId: actor.userId,
        actorRoles: actor.roles,
        correlationId: job.correlationId,
        details: {
          artifactId: artifact.artifactId,
          format: artifact.format,
          downloadEligible: 'true',
        },
      });
    }

    return {
      artifact: toPublicArtifact(artifact, downloadEligible),
      downloadToken,
    };
  }

  async downloadArtifact(params: {
    tenantId: string;
    jobId: string;
    actor: ActorContext;
    token: string;
  }): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
    const job = await this.jobs.getJob(params.tenantId, params.jobId, params.actor);
    this.assertExportJob(job);
    this.assertArtifactAccess(params.actor, job);

    const artifact = await this.artifacts.findByJobId(params.tenantId, params.jobId);
    if (!artifact) throw new NotFoundException('Artifact not found');
    if (!this.isDownloadEligible(artifact, params.actor)) {
      throw new ForbiddenException('Artifact not eligible for download');
    }
    if (artifact.downloadTokenHash !== hashToken(params.token)) {
      throw new ForbiddenException('Invalid download token');
    }

    const buffer = await this.storage.get(artifact.storageKey);
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.artifact.downloaded',
      jobId: job.id,
      actorId: params.actor.userId,
      actorRoles: params.actor.roles,
      correlationId: job.correlationId,
      details: {
        artifactId: artifact.artifactId,
        format: artifact.format,
        size: String(artifact.size),
        checksum: artifact.checksum,
      },
    });
    await this.safeActivity('artifact_download_requested', job);

    return { buffer, contentType: artifact.contentType, filename: artifact.filename };
  }

  /**
   * Worker path for export jobs — adapter resolve + dataset generation + storage.
   */
  async executeExportJob(job: ImportExportJob, workerId: string): Promise<ImportExportJob> {
    const format = normalizeFormat(String(job.metadata.format ?? ''));
    const startedAt = Date.now();
    await this.safeActivity('export_started', job);
    let current = await this.patchProgress(job, 'preparing', 10, 'Preparing export');

    let artifactRow: ExportArtifact | null = null;
    try {
      const policy = await this.tenantPolicy.getAdvancedPolicy(job.tenantId);
      const adapter = this.resolver.resolve({
        typeId: job.typeId,
        tenantId: job.tenantId,
        branchId: job.branchId,
        roles: ['owner'],
        allowDataExport: policy.allowDataExport,
        format,
      });

      artifactRow = await this.artifacts.save({
        artifactId: randomUUID(),
        jobId: current.id,
        tenantId: current.tenantId,
        format,
        size: 0,
        checksum: '',
        contentType: '',
        filename: '',
        status: 'preparing',
        storageKey: `${current.tenantId}/${current.id}/${format}`,
        downloadTokenHash: '',
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + DEFAULT_ARTIFACT_TTL_MS),
        deletedAt: null,
      });

      current = await this.patchProgress(current, 'generating', 40, 'Generating dataset');
      artifactRow = await this.artifacts.update({ ...artifactRow, status: 'generating' });

      const result: ExportResult = await adapter.execute({
        jobId: current.id,
        tenantId: current.tenantId,
        branchId: current.branchId,
        typeId: current.typeId,
        correlationId: current.correlationId,
        initiatedByUserId: current.initiatedByUserId,
        format,
        roles: [],
        filters: (current.metadata.filters as Record<string, unknown>) ?? {},
      });

      if (!result.success || !result.artifact) {
        current = await this.patchProgress(current, 'failed', 100, result.error ?? 'export_failed');
        await this.safeActivity('export_failed', current, { reason: result.error });
        await this.safeNotify('export_failed', current);
        return this.jobs.failJob(current.tenantId, current.id, result.error ?? 'export_failed', {
          autoRetry: false,
        });
      }

      current = await this.patchProgress(current, 'uploading', 70, 'Storing artifact');
      const put = await this.storage.put({
        storageKey: artifactRow.storageKey,
        buffer: result.artifact.bytes,
        contentType: result.artifact.contentType,
      });

      artifactRow = await this.artifacts.update({
        ...artifactRow,
        status: 'stored',
        size: put.size,
        checksum: put.checksum,
        contentType: result.artifact.contentType,
        filename: result.artifact.filename,
      });
      await this.safeActivity('artifact_created', current, {
        reason: artifactRow.artifactId,
      });

      current = await this.patchProgress(current, 'finalizing', 90, 'Finalizing');
      artifactRow = await this.artifacts.update({ ...artifactRow, status: 'available' });
      await this.safeActivity('artifact_available', current, {
        reason: artifactRow.artifactId,
      });
      await this.safeNotify('artifact_available', current);

      await this.audit.record({
        tenantId: current.tenantId,
        branchId: current.branchId,
        action: 'importExport.export.completed',
        jobId: current.id,
        actorId: current.initiatedByUserId,
        actorRoles: ['system'],
        correlationId: current.correlationId,
        details: {
          adapter: adapter.typeId,
          format,
          artifactId: artifactRow.artifactId,
          size: String(artifactRow.size),
          checksum: artifactRow.checksum,
          downloadEligible: 'true',
          workerId,
          durationMs: String(Date.now() - startedAt),
          rowCount: String(result.summary.rowCount),
        },
      });

      current = await this.jobRepo.update({
        ...current,
        warningCount: result.warnings.length,
        metadata: {
          ...current.metadata,
          exportSummary: result.summary,
          artifactId: artifactRow.artifactId,
          progress: progressPayload('completed', 100, 'Export completed'),
        },
      });

      await this.safeActivity('export_completed', current);
      await this.safeNotify('export_completed', current);

      this.logger.log(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'export_runtime',
          event: 'export_completed',
          jobId: current.id,
          adapter: adapter.typeId,
          format,
          durationMs: Date.now() - startedAt,
          artifactBytes: artifactRow.size,
          correlationId: current.correlationId,
        }),
      );

      return this.jobs.completeJob(current.tenantId, current.id, {
        withWarnings: result.warnings.length > 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'export_runtime_error';
      if (artifactRow && artifactRow.status !== 'available') {
        try {
          await this.artifacts.update({ ...artifactRow, status: 'deleted', deletedAt: new Date() });
          await this.storage.delete(artifactRow.storageKey);
        } catch {
          /* ignore cleanup errors */
        }
      }
      await this.safeActivity('export_failed', job, { reason: message });
      await this.safeNotify('export_failed', job);
      await this.audit.record({
        tenantId: job.tenantId,
        branchId: job.branchId,
        action: 'importExport.export.failed',
        jobId: job.id,
        actorId: 'system',
        actorRoles: ['system'],
        correlationId: job.correlationId,
        reason: message,
      });
      return this.jobs.failJob(job.tenantId, job.id, message, { autoRetry: true });
    }
  }

  /** Expire available artifacts past TTL, then delete previously expired artifacts. */
  async cleanupExpiredArtifacts(now = new Date()): Promise<{ expired: number; deleted: number }> {
    let expired = 0;
    let deleted = 0;

    // Pass 1: Available → Expired
    const due = await this.artifacts.findAvailablePastExpiry(now);
    for (const artifact of due) {
      await this.artifacts.update({ ...artifact, status: 'expired' });
      expired += 1;
    }

    // Pass 2: Expired → Deleted (artifacts already expired before this expire pass)
    const toDelete = await this.artifacts.findExpired(now);
    for (const artifact of toDelete) {
      if (artifact.status === 'deleted') continue;
      // Skip artifacts we just transitioned in this same run
      if (due.some((d) => d.artifactId === artifact.artifactId)) continue;
      await this.storage.delete(artifact.storageKey);
      await this.artifacts.update({
        ...artifact,
        status: 'deleted',
        deletedAt: now,
      });
      deleted += 1;
    }

    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'export_runtime',
        event: 'artifact_cleanup',
        expired,
        deleted,
      }),
    );
    return { expired, deleted };
  }

  private assertExportJob(job: ImportExportJob): void {
    if (job.direction !== 'export') {
      throw new BadRequestException('Not an export job');
    }
  }

  private assertArtifactAccess(actor: ActorContext, job: ImportExportJob): void {
    if (
      !rolesCanAccessResource(actor.roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'export') &&
      !rolesCanAccessResource(actor.roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
    ) {
      throw new ForbiddenException('Missing permission for artifact access');
    }
    if (actor.branchId && job.branchId && actor.branchId !== job.branchId) {
      throw new ForbiddenException('Branch isolation violation for artifact');
    }
  }

  private isDownloadEligible(artifact: ExportArtifact, actor: ActorContext): boolean {
    if (artifact.status !== 'available') return false;
    if (artifact.expiresAt.getTime() <= Date.now()) return false;
    if (artifact.deletedAt) return false;
    return (
      rolesCanAccessResource(actor.roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'export') ||
      rolesCanAccessResource(actor.roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'view')
    );
  }

  private async patchProgress(
    job: ImportExportJob,
    stage: ExportProgressStage,
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
      | 'export_started'
      | 'artifact_created'
      | 'artifact_available'
      | 'export_completed'
      | 'export_failed'
      | 'export_cancelled'
      | 'artifact_download_requested',
    job: ImportExportJob,
    extra?: { reason?: string },
  ): Promise<void> {
    try {
      const mapped =
        event === 'export_started'
          ? 'job_started'
          : event === 'export_completed'
            ? 'job_completed'
            : event === 'export_failed'
              ? 'job_failed'
              : event === 'export_cancelled'
                ? 'job_cancelled'
                : event === 'artifact_created' || event === 'artifact_available'
                  ? 'artifact_ready'
                  : 'artifact_download_requested';
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
          component: 'export_runtime',
          event,
          jobId: job.id,
          correlationId: job.correlationId,
        }),
      );
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'export_runtime',
          event: 'activity_emit_failed',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }

  /** Notification failures must never fail exports. */
  private async safeNotify(
    kind: 'export_completed' | 'export_failed' | 'artifact_available',
    job: ImportExportJob,
  ): Promise<void> {
    try {
      await this.notifications.notify(kind, job);
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'export_runtime',
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
          action: 'importExport.export.notification_failed',
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
  stage: ExportProgressStage,
  percent: number,
  message?: string,
): ExportProgress {
  return {
    stage,
    percent,
    message,
    updatedAt: new Date().toISOString(),
  };
}

function normalizeFormat(format: string): ExportFileFormat {
  const normalized = format.trim().toLowerCase();
  if (normalized !== 'csv' && normalized !== 'xlsx') {
    throw new ExportAdapterResolutionError(
      'format_unsupported',
      'Unsupported export format. Only CSV and XLSX are allowed.',
    );
  }
  return normalized;
}

function mintDownloadToken(): string {
  return randomBytes(32).toString('hex');
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function toPublicArtifact(artifact: ExportArtifact, downloadEligible: boolean): PublicArtifactView {
  return {
    artifactId: artifact.artifactId,
    jobId: artifact.jobId,
    format: artifact.format,
    size: artifact.size,
    checksum: artifact.checksum,
    contentType: artifact.contentType,
    filename: artifact.filename,
    createdAt: artifact.createdAt.toISOString(),
    expiresAt: artifact.expiresAt.toISOString(),
    status: artifact.status,
    downloadEligible,
  };
}
