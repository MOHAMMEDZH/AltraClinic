import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
  ServiceUnavailableException,
  forwardRef,
} from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import { isImportExportCenterEnabled } from '../config/import-export-config';
import {
  assertJobTransition,
  IllegalJobTransitionError,
  isCancellableJobStatus,
} from '../domain/job/import-export-job-state-machine';
import {
  DEFAULT_JOB_RETRY_POLICY,
  DEFAULT_JOB_TTL_MS,
  IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
  type ImportExportJob,
  type JobDirection,
  type JobMetadata,
  type JobPriority,
  type JobStatus,
} from '../domain/job/import-export-job.types';
import { IMPORT_EXPORT_LOG_KIND } from '../import-export.constants';
import { ImportExportRuntimeRegistry } from './import-export-runtime.registry';
import { ImportExportActivityEmitterService } from './import-export-activity.emitter';
import { ImportExportNotificationIntentService } from './import-export-notification-intent.service';
import { ImportExportRetryEngine } from './import-export-retry.engine';
import { NullImportExportExecutor } from './null-import-export.executor';
import {
  IMPORT_EXPORT_JOB_REPOSITORY,
  type ImportExportJobRepository,
} from './ports/import-export-job.repository';
import { ImportExportAuditLog } from '../infrastructure/import-export-audit.log';
import { ImportExportQueueService } from '../infrastructure/import-export-queue.service';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import { IMPORT_EXPORT_PERMISSION_RESOURCE } from '../import-export.constants';
import { ImportRuntimeService } from './import-runtime.service';
import { ExportRuntimeService } from './export-runtime.service';

export interface CreateImportExportJobInput {
  tenantId: string;
  branchId?: string | null;
  typeId: string;
  direction: JobDirection;
  initiatedByUserId: string;
  actorRoles: string[];
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  priority?: JobPriority;
  metadata?: JobMetadata;
  queueImmediately?: boolean;
  maxAttempts?: number;
  ttlMs?: number;
}

export interface ActorContext {
  userId: string;
  roles: string[];
  branchId?: string | null;
}

@Injectable()
export class ImportExportJobService {
  private readonly logger = new Logger(ImportExportJobService.name);
  private readonly retryEngine = new ImportExportRetryEngine();

  constructor(
    @Inject(IMPORT_EXPORT_JOB_REPOSITORY)
    private readonly jobs: ImportExportJobRepository,
    private readonly registry: ImportExportRuntimeRegistry,
    private readonly queue: ImportExportQueueService,
    private readonly executor: NullImportExportExecutor,
    private readonly activity: ImportExportActivityEmitterService,
    private readonly audit: ImportExportAuditLog,
    private readonly notifications: ImportExportNotificationIntentService,
    private readonly tenantPolicy: TenantPolicyService,
    @Optional()
    @Inject(forwardRef(() => ImportRuntimeService))
    private readonly importRuntime?: ImportRuntimeService,
    @Optional()
    @Inject(forwardRef(() => ExportRuntimeService))
    private readonly exportRuntime?: ExportRuntimeService,
  ) {}

  async createJob(input: CreateImportExportJobInput): Promise<ImportExportJob> {
    this.assertFeatureEnabled();
    this.assertRbac(input.actorRoles, input.direction === 'export' ? 'export' : 'create');
    await this.assertLicense(input.tenantId, input.direction);

    const catalogEntry = this.registry.getByTypeId(input.typeId);
    if (!catalogEntry) {
      throw new BadRequestException(`Unknown import/export typeId: ${input.typeId}`);
    }
    if (catalogEntry.direction !== input.direction) {
      throw new BadRequestException(
        `direction ${input.direction} does not match catalog type ${input.typeId}`,
      );
    }

    const existing = await this.jobs.findByIdempotencyKey(input.tenantId, input.idempotencyKey);
    if (existing) {
      return existing;
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    const now = new Date();
    const job = await this.jobs.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      typeId: input.typeId,
      direction: input.direction,
      status: 'draft',
      priority: input.priority ?? 'normal',
      initiatedByUserId: input.initiatedByUserId,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      causationId: input.causationId ?? null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_JOB_RETRY_POLICY.maxAttempts,
      baseDelayMs: DEFAULT_JOB_RETRY_POLICY.baseDelayMs,
      maxDelayMs: DEFAULT_JOB_RETRY_POLICY.maxDelayMs,
      metadata: { source: 'api', ...(input.metadata ?? {}) },
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_JOB_TTL_MS)),
      scheduledAt: null,
    });

    await this.activity.emit('job_created', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.job.created',
      jobId: job.id,
      actorId: input.initiatedByUserId,
      actorRoles: input.actorRoles,
      correlationId: job.correlationId,
      details: { typeId: job.typeId, direction: job.direction, status: job.status },
    });

    if (input.queueImmediately !== false) {
      return this.queueJob(job.tenantId, job.id, {
        userId: input.initiatedByUserId,
        roles: input.actorRoles,
      });
    }
    return job;
  }

  async queueJob(tenantId: string, jobId: string, actor: ActorContext): Promise<ImportExportJob> {
    this.assertFeatureEnabled();
    let job = await this.requireJob(tenantId, jobId, actor);
    this.assertRbac(actor.roles, job.direction === 'export' ? 'export' : 'create');

    if (job.status === 'queued') return job;

    job = await this.transition(job, 'queued', actor, {
      scheduledAt: new Date(),
    });

    await this.queue.enqueueJob(
      {
        jobId: job.id,
        tenantId: job.tenantId,
        correlationId: job.correlationId,
      },
      { jobId: `ie:${job.id}:${job.attemptCount}` },
    );

    await this.activity.emit('job_queued', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.job.state_changed',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { from: 'draft_or_retrying', to: 'queued' },
    });

    return job;
  }

  async startJob(tenantId: string, jobId: string, leaseOwner: string): Promise<ImportExportJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'running') return job;
    if (job.status === 'retrying') {
      job = await this.transition(job, 'queued', systemActor(), {});
    }
    job = await this.transition(job, 'running', systemActor(), {
      startedAt: new Date(),
      leasedAt: new Date(),
      leaseOwner,
      attemptCount: job.attemptCount + 1,
    });
    await this.activity.emit('job_started', basePayload(job));
    return job;
  }

  async completeJob(
    tenantId: string,
    jobId: string,
    options: { withWarnings?: boolean } = {},
  ): Promise<ImportExportJob> {
    let job = await this.requireJob(tenantId, jobId);
    const next: JobStatus = options.withWarnings ? 'completed_with_warnings' : 'completed';
    job = await this.transition(job, next, systemActor(), {
      completedAt: new Date(),
      leaseOwner: null,
      leasedAt: null,
      warningCount: options.withWarnings ? Math.max(1, job.warningCount) : job.warningCount,
    });
    await this.activity.emit('job_completed', basePayload(job));
    await this.notifications.notify(
      job.direction === 'import' ? 'import_completed' : 'export_completed',
      job,
    );
    return job;
  }

  async failJob(
    tenantId: string,
    jobId: string,
    error: string,
    options: { autoRetry?: boolean } = {},
  ): Promise<ImportExportJob> {
    let job = await this.requireJob(tenantId, jobId);
    job = await this.transition(job, 'failed', systemActor(), {
      lastError: error.slice(0, 1000),
      failureReason: 'orchestration_error',
      leaseOwner: null,
      leasedAt: null,
      metadata: {
        ...job.metadata,
        forceFailOnce: false,
      },
    });
    await this.activity.emit('job_failed', { ...basePayload(job), reason: error });
    await this.notifications.notify('job_failed', job);

    if (options.autoRetry !== false) {
      return this.retryOrDeadLetter(job);
    }
    return job;
  }

  async retryJob(tenantId: string, jobId: string, actor: ActorContext): Promise<ImportExportJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);

    if (job.status === 'dead_letter') {
      // Manual requeue from DLQ: move to failed then retrying path via direct queued.
      job = {
        ...job,
        status: 'failed',
        attemptCount: 0,
        failureReason: null,
        lastError: null,
        deadLetteredAt: null,
      };
      job = await this.jobs.update(job);
    }

    if (job.status !== 'failed' && job.status !== 'retrying') {
      throw new BadRequestException(`Cannot retry job in status ${job.status}`);
    }

    const decision = this.retryEngine.decide(job, job.lastError ?? undefined);
    if (!decision.shouldRetry && job.status === 'failed') {
      return this.moveToDeadLetter(tenantId, jobId, decision.reason, actor);
    }

    job = await this.transition(job, 'retrying', actor, {
      scheduledAt: new Date(Date.now() + decision.delayMs),
    });
    await this.activity.emit('job_retry', {
      ...basePayload(job),
      reason: `delayMs=${decision.delayMs}`,
    });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.job.requeued',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { delayMs: String(decision.delayMs), nextAttempt: String(decision.nextAttempt) },
    });
    await this.notifications.notify('retry_scheduled', job);

    job = await this.transition(job, 'queued', actor, {});
    await this.queue.enqueueJob(
      {
        jobId: job.id,
        tenantId: job.tenantId,
        correlationId: job.correlationId,
      },
      { delay: decision.delayMs, jobId: `ie:${job.id}:${job.attemptCount}:retry` },
    );
    await this.activity.emit('job_queued', basePayload(job));
    return job;
  }

  async cancelJob(tenantId: string, jobId: string, actor: ActorContext): Promise<ImportExportJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);

    if (!isCancellableJobStatus(job.status)) {
      throw new ConflictException(`Cannot cancel job in status ${job.status}`);
    }

    job = await this.transition(job, 'cancelled', actor, {
      completedAt: new Date(),
      failureReason: 'cancelled',
      leaseOwner: null,
      leasedAt: null,
    });
    await this.activity.emit('job_cancelled', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.job.cancelled',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
    });
    return job;
  }

  async expireJob(tenantId: string, jobId: string): Promise<ImportExportJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'expired') return job;
    job = await this.transition(job, 'expired', systemActor(), {
      completedAt: new Date(),
      failureReason: 'expired',
      leaseOwner: null,
      leasedAt: null,
    });
    await this.activity.emit('job_expired', basePayload(job));
    return job;
  }

  async moveToDeadLetter(
    tenantId: string,
    jobId: string,
    reason: string,
    actor: ActorContext = systemActor(),
  ): Promise<ImportExportJob> {
    let job = await this.requireJob(tenantId, jobId, actor);
    if (job.status !== 'failed' && job.status !== 'retrying') {
      if (job.status !== 'dead_letter') {
        try {
          assertJobTransition(job.status, 'failed');
          job = await this.transition(job, 'failed', actor, {
            lastError: reason.slice(0, 1000),
            failureReason: 'max_attempts_exceeded',
          });
        } catch {
          throw new ConflictException(`Cannot dead-letter job in status ${job.status}`);
        }
      }
    }
    if (job.status === 'dead_letter') return job;

    job = await this.transition(job, 'dead_letter', actor, {
      deadLetteredAt: new Date(),
      failureReason: 'max_attempts_exceeded',
      lastError: reason.slice(0, 1000),
      leaseOwner: null,
      leasedAt: null,
    });

    await this.jobs.saveDeadLetter({
      id: randomUUID(),
      tenantId: job.tenantId,
      jobId: job.id,
      reason: reason.slice(0, 500),
      attempts: job.attemptCount,
      lastError: job.lastError,
      correlationId: job.correlationId,
    });

    await this.activity.emit('job_dead_letter', { ...basePayload(job), reason });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'importExport.job.dead_lettered',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      reason,
      details: { attempts: String(job.attemptCount) },
    });
    await this.notifications.notify('dead_letter_reached', job);
    return job;
  }

  async getJob(tenantId: string, jobId: string, actor: ActorContext): Promise<ImportExportJob> {
    this.assertRbac(actor.roles, 'view');
    return this.requireJob(tenantId, jobId, actor);
  }

  async listJobs(
    tenantId: string,
    actor: ActorContext,
    filter: {
      branchId?: string | null;
      status?: JobStatus;
      typeId?: string;
      direction?: JobDirection;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<ImportExportJob[]> {
    this.assertRbac(actor.roles, 'view');
    const branchId =
      filter.branchId !== undefined ? filter.branchId : actor.branchId ?? undefined;
    return this.jobs.list({
      tenantId,
      branchId: branchId ?? undefined,
      status: filter.status,
      typeId: filter.typeId,
      direction: filter.direction,
      limit: filter.limit,
      offset: filter.offset,
    });
  }

  /**
   * Worker entry: lease → Import/Export Runtime or Null Executor.
   */
  async processQueuedJob(
    tenantId: string,
    jobId: string,
    workerId: string,
  ): Promise<ImportExportJob> {
    let job = await this.startJob(tenantId, jobId, workerId);
    if (job.direction === 'import' && job.metadata?.runtime === 'import' && this.importRuntime) {
      return this.importRuntime.executeImportJob(job, workerId);
    }
    if (job.direction === 'export' && job.metadata?.runtime === 'export' && this.exportRuntime) {
      return this.exportRuntime.executeExportJob(job, workerId);
    }
    const result = await this.executor.execute(job);
    if (result.success) {
      return this.completeJob(tenantId, jobId, {
        withWarnings: result.warnings.length > 0,
      });
    }
    return this.failJob(tenantId, jobId, result.error ?? 'null_executor_failure', {
      autoRetry: true,
    });
  }

  async expireDueJobs(now = new Date()): Promise<number> {
    const candidates = await this.jobs.findExpiredCandidates(now);
    let count = 0;
    for (const job of candidates) {
      try {
        await this.expireJob(job.tenantId, job.id);
        count += 1;
      } catch (error) {
        this.logger.warn(
          JSON.stringify({
            kind: IMPORT_EXPORT_LOG_KIND,
            component: 'job_service',
            event: 'expire_skipped',
            jobId: job.id,
            status: job.status,
            message: error instanceof Error ? error.message : String(error),
          }),
        );
      }
    }
    return count;
  }

  async getEngineHealth() {
    try {
      const counts = await this.jobs.countByStatus();
      return {
        jobsByStatus: counts,
        nullExecutorExecutions: this.executor.getExecutionCount(),
        queueJobName: IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
      };
    } catch (error) {
      this.logger.warn(
        JSON.stringify({
          kind: IMPORT_EXPORT_LOG_KIND,
          component: 'job_service',
          event: 'health_jobs_unavailable',
          message: error instanceof Error ? error.message : String(error),
        }),
      );
      return {
        jobsByStatus: {},
        nullExecutorExecutions: this.executor.getExecutionCount(),
        queueJobName: IMPORT_EXPORT_JOB_QUEUE_JOB_NAME,
        unavailable: true,
      };
    }
  }

  private async retryOrDeadLetter(job: ImportExportJob): Promise<ImportExportJob> {
    const decision = this.retryEngine.decide(job, job.lastError ?? undefined);
    if (decision.shouldDeadLetter) {
      return this.moveToDeadLetter(job.tenantId, job.id, decision.reason);
    }
    return this.retryJob(job.tenantId, job.id, systemActor());
  }

  private async transition(
    job: ImportExportJob,
    to: JobStatus,
    actor: ActorContext,
    patch: Partial<ImportExportJob>,
  ): Promise<ImportExportJob> {
    try {
      assertJobTransition(job.status, to);
    } catch (error) {
      if (error instanceof IllegalJobTransitionError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
    const next: ImportExportJob = {
      ...job,
      ...patch,
      status: to,
      updatedAt: new Date(),
    };
    const saved = await this.jobs.update(next);
    this.logger.log(
      JSON.stringify({
        kind: IMPORT_EXPORT_LOG_KIND,
        component: 'job_service',
        event: 'state_transition',
        jobId: saved.id,
        from: job.status,
        to: saved.status,
        correlationId: saved.correlationId,
        actorId: actor.userId,
      }),
    );
    return saved;
  }

  private async requireJob(
    tenantId: string,
    jobId: string,
    actor?: ActorContext,
  ): Promise<ImportExportJob> {
    const job = await this.jobs.findById(tenantId, jobId);
    if (!job) throw new NotFoundException(`Job ${jobId} not found`);
    if (actor?.branchId && job.branchId && actor.branchId !== job.branchId) {
      throw new ForbiddenException('Branch isolation violation for import/export job');
    }
    return job;
  }

  private assertFeatureEnabled(): void {
    if (!isImportExportCenterEnabled()) {
      throw new ServiceUnavailableException('Import/Export Center is disabled');
    }
  }

  private assertRbac(roles: string[], action: 'view' | 'create' | 'manage' | 'export'): void {
    if (!rolesCanAccessResource(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, action)) {
      throw new ForbiddenException(`Missing permission api.importExport:${action}`);
    }
  }

  private async assertLicense(tenantId: string, direction: JobDirection): Promise<void> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    if (direction === 'import' && !policy.allowDataImport) {
      throw new ForbiddenException('Licensing denied: allowDataImport=false');
    }
    if (direction === 'export' && !policy.allowDataExport) {
      throw new ForbiddenException('Licensing denied: allowDataExport=false');
    }
  }
}

function basePayload(job: ImportExportJob) {
  return {
    tenantId: job.tenantId,
    branchId: job.branchId,
    jobId: job.id,
    typeId: job.typeId,
    direction: job.direction,
    status: job.status,
    correlationId: job.correlationId,
  };
}

function systemActor(): ActorContext {
  return { userId: 'system', roles: ['super_admin'] };
}
