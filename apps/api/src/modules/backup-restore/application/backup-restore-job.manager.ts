import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { TenantPolicyService } from '../../settings/application/services/tenant-policy.service';
import {
  isBackupRestoreCenterEnabled,
  loadBackupRestoreFoundationConfig,
} from '../config/backup-restore-config';
import {
  assertBackupRestoreJobTransition,
  IllegalBackupRestoreJobTransitionError,
  isActiveLockStatus,
  isCancellableBackupRestoreJobStatus,
} from '../domain/job/backup-restore-job-state-machine';
import {
  DEFAULT_BACKUP_RESTORE_JOB_TTL_MS,
  DEFAULT_BACKUP_RESTORE_RETRY_POLICY,
  type BackupRestoreCancelReason,
  type BackupRestoreFailureClass,
  type BackupRestoreJob,
  type BackupRestoreJobKind,
  type BackupRestoreJobMetadata,
  type BackupRestoreJobPriority,
  type BackupRestoreJobProgress,
  type BackupRestoreJobStatus,
  type BackupRestoreJobTransitionRecord,
} from '../domain/job/backup-restore-job.types';
import {
  BACKUP_RESTORE_LOG_KIND,
  BACKUP_RESTORE_PERMISSION_RESOURCE,
} from '../backup-restore.constants';
import { STATIC_BACKUP_RESTORE_CATALOG } from '../catalog/static-backup-restore.catalog';
import { BackupRestoreActivityEmitterService } from './backup-restore-activity.emitter';
import { BackupRestoreNotificationIntentRegistrar } from './backup-restore-notification-intent.registrar';
import { BackupRestoreRetryEngine } from './backup-restore-retry.engine';
import { BackupRestoreJobObservabilityHooks } from './backup-restore-job-observability.hooks';
import {
  BACKUP_RESTORE_JOB_REPOSITORY,
  type BackupRestoreJobRepository,
} from './ports/backup-restore-job.repository';
import { BackupRestoreAuditLog } from '../infrastructure/backup-restore-audit.log';
import { rolesCanAccessResource } from '../../../common/authorization/permission-matrix.util';
import type { PermissionAction } from '../../../common/authorization/permission-matrix.validation';

export interface CreateBackupRestoreJobInput {
  tenantId: string;
  branchId?: string | null;
  kind: BackupRestoreJobKind;
  typeId: string;
  initiatedByUserId: string;
  actorRoles: string[];
  idempotencyKey: string;
  correlationId?: string;
  causationId?: string | null;
  priority?: BackupRestoreJobPriority;
  metadata?: BackupRestoreJobMetadata;
  /** When true, transitions created → queued (metadata only; no BullMQ). */
  queueImmediately?: boolean;
  maxAttempts?: number;
  ttlMs?: number;
}

export interface ActorContext {
  userId: string;
  roles: string[];
  branchId?: string | null;
}

function systemActor(): ActorContext {
  return { userId: 'system', roles: ['system'] };
}

function basePayload(job: BackupRestoreJob) {
  return {
    tenantId: job.tenantId,
    branchId: job.branchId,
    jobId: job.id,
    kind: job.kind,
    typeId: job.typeId,
    status: job.status,
    correlationId: job.correlationId,
  };
}

/**
 * Phase 43b — Job Manager / Job Engine.
 * Lifecycle orchestration only. No backup/restore execution. No queue consumers.
 */
@Injectable()
export class BackupRestoreJobManager {
  private readonly logger = new Logger(BackupRestoreJobManager.name);
  private readonly retryEngine = new BackupRestoreRetryEngine();

  constructor(
    @Inject(BACKUP_RESTORE_JOB_REPOSITORY)
    private readonly jobs: BackupRestoreJobRepository,
    private readonly activity: BackupRestoreActivityEmitterService,
    private readonly audit: BackupRestoreAuditLog,
    private readonly notifications: BackupRestoreNotificationIntentRegistrar,
    private readonly observability: BackupRestoreJobObservabilityHooks,
    private readonly tenantPolicy: TenantPolicyService,
  ) {}

  async createJob(input: CreateBackupRestoreJobInput): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    this.assertRbac(input.actorRoles, input.kind === 'restore' ? 'manage' : 'create');
    await this.assertLicense(input.tenantId);
    this.assertConfigurationReady();
    this.assertCatalogType(input.typeId, input.kind);
    this.assertRequiredMetadata(input);

    const existing = await this.jobs.findByIdempotencyKey(
      input.tenantId,
      input.idempotencyKey,
    );
    if (existing) return existing;

    const targetKey = this.targetKeyFromMetadata(input.kind, input.metadata ?? { source: 'api' });
    if (targetKey) {
      const active = await this.jobs.findActiveByKindTarget(
        input.tenantId,
        input.kind,
        targetKey,
      );
      if (active.length > 0) {
        throw new ConflictException(
          `Duplicate ${input.kind} job already active for target ${targetKey}`,
        );
      }
    }

    const correlationId = input.correlationId?.trim() || randomUUID();
    const now = new Date();
    let job = await this.jobs.create({
      id: randomUUID(),
      tenantId: input.tenantId,
      branchId: input.branchId ?? null,
      kind: input.kind,
      typeId: input.typeId,
      status: 'created',
      priority: input.priority ?? 'normal',
      initiatedByUserId: input.initiatedByUserId,
      ownerUserId: input.initiatedByUserId,
      idempotencyKey: input.idempotencyKey,
      correlationId,
      causationId: input.causationId ?? null,
      attemptCount: 0,
      maxAttempts: input.maxAttempts ?? DEFAULT_BACKUP_RESTORE_RETRY_POLICY.maxAttempts,
      baseDelayMs: DEFAULT_BACKUP_RESTORE_RETRY_POLICY.baseDelayMs,
      maxDelayMs: DEFAULT_BACKUP_RESTORE_RETRY_POLICY.maxDelayMs,
      metadata: { source: 'api', ...(input.metadata ?? {}) },
      expiresAt: new Date(now.getTime() + (input.ttlMs ?? DEFAULT_BACKUP_RESTORE_JOB_TTL_MS)),
      scheduledAt: null,
    });

    await this.activity.emit(
      input.kind === 'restore' ? 'restore_requested' : 'job_created',
      basePayload(job),
    );
    if (input.kind === 'backup') {
      await this.activity.emit('backup_created', basePayload(job));
    }
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.created',
      jobId: job.id,
      actorId: input.initiatedByUserId,
      actorRoles: input.actorRoles,
      correlationId: job.correlationId,
      details: { kind: job.kind, typeId: job.typeId, status: job.status },
    });

    if (input.queueImmediately !== false) {
      job = await this.markQueued(job.tenantId, job.id, {
        userId: input.initiatedByUserId,
        roles: input.actorRoles,
      });
    }
    return job;
  }

  /** Metadata-only queue mark — does NOT enqueue BullMQ. */
  async markQueued(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
  ): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    let job = await this.requireJob(tenantId, jobId, actor);
    this.assertRbac(actor.roles, job.kind === 'restore' ? 'manage' : 'create');
    if (job.status === 'queued') return job;

    job = await this.transition(job, 'queued', actor, {
      scheduledAt: new Date(),
    });

    await this.activity.emit('job_queued', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.state_changed',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { to: 'queued' },
    });
    await this.notifications.registerIntent('job_queued', job);
    return job;
  }

  async startJob(
    tenantId: string,
    jobId: string,
    leaseOwner: string,
  ): Promise<BackupRestoreJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'running') {
      if (job.leaseOwner && job.leaseOwner !== leaseOwner) {
        throw new ConflictException('Job already leased by another owner');
      }
      return job;
    }
    if (job.status === 'retrying') {
      job = await this.transition(job, 'queued', systemActor(), {});
    }
    if (job.status === 'queued' || job.status === 'waiting') {
      job = await this.transition(job, 'validating', systemActor(), {
        progress: {
          ...job.progress,
          phase: 'validating',
          percent: 5,
          statusMessage: 'Validating job',
          updatedAt: new Date(),
        },
      });
    }
    job = await this.transition(job, 'running', systemActor(), {
      startedAt: job.startedAt ?? new Date(),
      attemptCount: job.attemptCount + 1,
      leasedAt: new Date(),
      leaseOwner,
      progress: {
        ...job.progress,
        phase: 'running',
        percent: Math.max(job.progress.percent, 10),
        statusMessage: 'Running (orchestration only)',
        updatedAt: new Date(),
      },
    });

    await this.activity.emit(
      job.kind === 'verification' ? 'verification_started' : 'job_started',
      basePayload(job),
    );
    await this.notifications.registerIntent('job_started', job);
    return job;
  }

  async pauseJob(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
  ): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);
    job = await this.transition(job, 'paused', actor, {
      leaseOwner: null,
      leasedAt: null,
      progress: {
        ...job.progress,
        phase: 'paused',
        statusMessage: 'Paused',
        updatedAt: new Date(),
      },
    });
    await this.activity.emit('job_paused', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.state_changed',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { to: 'paused' },
    });
    return job;
  }

  async resumeJob(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
  ): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);
    job = await this.transition(job, 'running', actor, {
      leasedAt: new Date(),
      leaseOwner: actor.userId,
      progress: {
        ...job.progress,
        phase: 'running',
        statusMessage: 'Resumed',
        updatedAt: new Date(),
      },
    });
    await this.activity.emit('job_resumed', basePayload(job));
    return job;
  }

  async updateProgress(
    tenantId: string,
    jobId: string,
    progress: Partial<BackupRestoreJobProgress>,
  ): Promise<BackupRestoreJob> {
    const job = await this.requireJob(tenantId, jobId);
    if (!isActiveLockStatus(job.status) && job.status !== 'paused') {
      throw new ConflictException(`Cannot update progress in status ${job.status}`);
    }
    const next: BackupRestoreJob = {
      ...job,
      progress: {
        ...job.progress,
        ...progress,
        percent: clampPercent(progress.percent ?? job.progress.percent),
        updatedAt: new Date(),
      },
    };
    return this.jobs.update(next);
  }

  async markCompleted(
    tenantId: string,
    jobId: string,
    options?: { withVerification?: boolean },
  ): Promise<BackupRestoreJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'completed' || job.status === 'verified') return job;

    if (options?.withVerification) {
      job = await this.transition(job, 'verification_pending', systemActor(), {
        progress: {
          ...job.progress,
          phase: 'verification_pending',
          percent: 90,
          statusMessage: 'Verification pending',
          updatedAt: new Date(),
        },
        leaseOwner: null,
        leasedAt: null,
      });
      await this.notifications.registerIntent('verification_pending', job);
      return job;
    }

    job = await this.transition(job, 'completed', systemActor(), {
      completedAt: new Date(),
      leaseOwner: null,
      leasedAt: null,
      progress: {
        ...job.progress,
        phase: 'completed',
        percent: 100,
        statusMessage: 'Completed (orchestration)',
        updatedAt: new Date(),
      },
    });

    await this.activity.emit('job_completed', basePayload(job));
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.completed',
      jobId: job.id,
      actorId: 'system',
      actorRoles: ['system'],
      correlationId: job.correlationId,
      details: { kind: job.kind, status: job.status },
    });
    await this.notifications.registerIntent('job_completed', job);
    if (job.kind === 'backup') {
      await this.notifications.registerIntent('backup_succeeded', job);
    } else if (job.kind === 'restore') {
      await this.notifications.registerIntent('restore_completed', job);
    }
    return job;
  }

  async markVerified(tenantId: string, jobId: string): Promise<BackupRestoreJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'verified') return job;
    if (job.status === 'running') {
      job = await this.transition(job, 'verification_pending', systemActor(), {});
    }
    job = await this.transition(job, 'verified', systemActor(), {
      completedAt: new Date(),
      leaseOwner: null,
      leasedAt: null,
      progress: {
        ...job.progress,
        phase: 'verified',
        percent: 100,
        statusMessage: 'Verified',
        updatedAt: new Date(),
      },
    });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.verified',
      jobId: job.id,
      actorId: 'system',
      actorRoles: ['system'],
      correlationId: job.correlationId,
    });
    return job;
  }

  async markFailed(
    tenantId: string,
    jobId: string,
    failureClass: BackupRestoreFailureClass,
    errorMessage: string,
    options?: { autoRetry?: boolean },
  ): Promise<BackupRestoreJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'failed' || job.status === 'dead_letter') return job;

    job = await this.transition(job, 'failed', systemActor(), {
      lastError: errorMessage,
      failureClass,
      leaseOwner: null,
      leasedAt: null,
      progress: {
        ...job.progress,
        phase: 'failed',
        statusMessage: errorMessage,
        updatedAt: new Date(),
      },
    });

    this.observability.onFailure(job.correlationId, failureClass);
    await this.activity.emit('job_failed', {
      ...basePayload(job),
      reason: errorMessage,
    });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.failed',
      jobId: job.id,
      actorId: 'system',
      actorRoles: ['system'],
      correlationId: job.correlationId,
      details: { failureClass, message: errorMessage.slice(0, 200) },
      reason: errorMessage,
    });
    await this.notifications.registerIntent('job_failed', job);
    if (job.kind === 'backup') {
      await this.notifications.registerIntent('backup_failed', job);
    } else if (job.kind === 'restore') {
      await this.notifications.registerIntent('restore_failed', job);
    } else if (failureClass === 'VerificationFailure') {
      await this.notifications.registerIntent('verification_failed', job);
    }

    if (options?.autoRetry !== false) {
      return this.retryOrDeadLetter(job);
    }
    return job;
  }

  async scheduleRetry(tenantId: string, jobId: string, actor: ActorContext): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);
    if (job.status !== 'failed') {
      throw new ConflictException('Only failed jobs can be scheduled for retry');
    }
    const decision = this.retryEngine.decide(job);
    if (!decision.shouldRetry) {
      return this.moveToDeadLetter(job, decision.reason);
    }

    job = await this.transition(job, 'retrying', actor, {
      scheduledAt: new Date(Date.now() + decision.delayMs),
      metadata: {
        ...job.metadata,
        lastRetryDelayMs: decision.delayMs,
        lastRetryReason: decision.reason,
      },
    });
    this.observability.onRetry(job.correlationId);
    await this.activity.emit('job_retry', {
      ...basePayload(job),
      reason: decision.reason,
    });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.retry_scheduled',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { delayMs: String(decision.delayMs), reason: decision.reason },
    });

    // Metadata-only requeue — no worker delay.
    return this.transition(job, 'queued', actor, {
      scheduledAt: job.scheduledAt,
    });
  }

  async cancelJob(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
    reason: BackupRestoreCancelReason = 'user',
  ): Promise<BackupRestoreJob> {
    this.assertFeatureEnabled();
    this.assertRbac(actor.roles, 'manage');
    let job = await this.requireJob(tenantId, jobId, actor);

    if (job.status === 'cancelled') return job;
    if (!isCancellableBackupRestoreJobStatus(job.status)) {
      throw new ConflictException(`Cannot cancel job in status ${job.status}`);
    }

    if (job.status === 'running' || job.status === 'validating' || job.status === 'paused') {
      job = await this.transition(job, 'cancelling', actor, {
        cancelReason: reason,
        progress: {
          ...job.progress,
          phase: 'cancelling',
          statusMessage: `Cancelling (${reason})`,
          updatedAt: new Date(),
        },
      });
    }

    job = await this.transition(job, 'cancelled', actor, {
      cancelReason: reason,
      completedAt: new Date(),
      leaseOwner: null,
      leasedAt: null,
      progress: {
        ...job.progress,
        phase: 'cancelled',
        statusMessage: `Cancelled (${reason})`,
        updatedAt: new Date(),
      },
    });

    await this.activity.emit('job_cancelled', {
      ...basePayload(job),
      reason,
    });
    await this.audit.record({
      tenantId: job.tenantId,
      branchId: job.branchId,
      action: 'backupRestore.job.cancelled',
      jobId: job.id,
      actorId: actor.userId,
      actorRoles: actor.roles,
      correlationId: job.correlationId,
      details: { reason },
      reason,
    });
    await this.notifications.registerIntent('job_cancelled', job);
    return job;
  }

  async cancelForFeatureShutdown(tenantId: string, jobId: string): Promise<BackupRestoreJob> {
    return this.cancelJob(tenantId, jobId, systemActor(), 'feature_flag');
  }

  async expireJob(tenantId: string, jobId: string): Promise<BackupRestoreJob> {
    let job = await this.requireJob(tenantId, jobId);
    if (job.status === 'expired') return job;
    job = await this.transition(job, 'expired', systemActor(), {
      completedAt: new Date(),
      leaseOwner: null,
      leasedAt: null,
    });
    await this.activity.emit('job_expired', basePayload(job));
    return job;
  }

  async expireDueJobs(now = new Date(), limit = 100): Promise<number> {
    const candidates = await this.jobs.findExpiredCandidates(now, limit);
    let count = 0;
    for (const job of candidates) {
      try {
        await this.expireJob(job.tenantId, job.id);
        count += 1;
      } catch (error) {
        if (!(error instanceof IllegalBackupRestoreJobTransitionError)) {
          this.logger.warn({
            kind: BACKUP_RESTORE_LOG_KIND,
            event: 'expire_failed',
            jobId: job.id,
            message: error instanceof Error ? error.message : 'unknown',
          });
        }
      }
    }
    return count;
  }

  async getJob(
    tenantId: string,
    jobId: string,
    actor: ActorContext,
  ): Promise<BackupRestoreJob> {
    this.assertRbac(actor.roles, 'view');
    return this.requireJob(tenantId, jobId, actor);
  }

  async listJobs(
    tenantId: string,
    actor: ActorContext,
    filter?: { status?: BackupRestoreJobStatus; kind?: BackupRestoreJobKind },
  ): Promise<BackupRestoreJob[]> {
    this.assertRbac(actor.roles, 'view');
    return this.jobs.list({
      tenantId,
      branchId: actor.branchId,
      status: filter?.status,
      kind: filter?.kind,
    });
  }

  async getEngineHealth(tenantId?: string) {
    const config = loadBackupRestoreFoundationConfig();
    const jobsByStatus = await this.jobs.countByStatus(tenantId);
    return {
      jobEngineReady: true,
      repositoryReady: true,
      configurationReady: config.defaults.storageProvider === 'unconfigured' || true,
      featureFlagsReady: true,
      featureEnabled: config.featureEnabled,
      queueWired: false,
      workerWired: false,
      schedulerWired: false,
      jobsByStatus,
      notificationIntentKinds: this.notifications.listRegisteredKinds().length,
    };
  }

  private async retryOrDeadLetter(job: BackupRestoreJob): Promise<BackupRestoreJob> {
    const decision = this.retryEngine.decide(job);
    if (decision.shouldDeadLetter) {
      return this.moveToDeadLetter(job, decision.reason);
    }
    let next = await this.transition(job, 'retrying', systemActor(), {
      scheduledAt: new Date(Date.now() + decision.delayMs),
      metadata: {
        ...job.metadata,
        lastRetryDelayMs: decision.delayMs,
        lastRetryReason: decision.reason,
      },
    });
    this.observability.onRetry(job.correlationId);
    await this.activity.emit('job_retry', {
      ...basePayload(next),
      reason: decision.reason,
    });
    next = await this.transition(next, 'queued', systemActor(), {
      scheduledAt: next.scheduledAt,
    });
    return next;
  }

  private async moveToDeadLetter(
    job: BackupRestoreJob,
    reason: string,
  ): Promise<BackupRestoreJob> {
    let next = job;
    if (job.status !== 'dead_letter') {
      next = await this.transition(job, 'dead_letter', systemActor(), {
        deadLetteredAt: new Date(),
        completedAt: new Date(),
        leaseOwner: null,
        leasedAt: null,
        lastError: reason,
        failureClass: job.failureClass ?? 'SystemFailure',
      });
    }
    await this.jobs.saveDeadLetter({
      id: randomUUID(),
      tenantId: next.tenantId,
      jobId: next.id,
      reason,
      attempts: next.attemptCount,
      lastError: next.lastError,
      failureClass: next.failureClass,
      correlationId: next.correlationId,
    });
    await this.activity.emit('job_dead_letter', {
      ...basePayload(next),
      reason,
    });
    await this.audit.record({
      tenantId: next.tenantId,
      branchId: next.branchId,
      action: 'backupRestore.job.dead_lettered',
      jobId: next.id,
      actorId: 'system',
      actorRoles: ['system'],
      correlationId: next.correlationId,
      reason,
    });
    return next;
  }

  private async transition(
    job: BackupRestoreJob,
    to: BackupRestoreJobStatus,
    actor: ActorContext,
    patch: Partial<BackupRestoreJob>,
  ): Promise<BackupRestoreJob> {
    assertBackupRestoreJobTransition(job.status, to);
    const record: BackupRestoreJobTransitionRecord = {
      from: job.status,
      to,
      at: new Date(),
      actorId: actor.userId,
      reason: typeof patch.lastError === 'string' ? patch.lastError : null,
    };
    const next: BackupRestoreJob = {
      ...job,
      ...patch,
      status: to,
      progress: patch.progress ? { ...job.progress, ...patch.progress } : job.progress,
      metadata: patch.metadata
        ? ({ ...job.metadata, ...patch.metadata } as BackupRestoreJobMetadata)
        : job.metadata,
      transitions: [...job.transitions, record],
    };
    this.observability.onTransition(job.status, to, job.correlationId);
    this.logger.log({
      kind: BACKUP_RESTORE_LOG_KIND,
      component: 'job_manager',
      event: 'transition',
      jobId: job.id,
      from: job.status,
      to,
      actorId: actor.userId,
      correlationId: job.correlationId,
    });
    return this.jobs.update(next);
  }

  private async requireJob(
    tenantId: string,
    jobId: string,
    actor?: ActorContext,
  ): Promise<BackupRestoreJob> {
    const job = await this.jobs.findById(tenantId, jobId);
    if (!job) throw new NotFoundException(`Job not found: ${jobId}`);
    if (
      actor?.branchId !== undefined &&
      actor.branchId !== null &&
      job.branchId !== null &&
      job.branchId !== actor.branchId
    ) {
      throw new ForbiddenException('Job branch isolation violation');
    }
    return job;
  }

  private assertFeatureEnabled(): void {
    if (!isBackupRestoreCenterEnabled()) {
      throw new ServiceUnavailableException(
        'BACKUP_RESTORE_CENTER_ENABLED=false — Backup & Restore Center dormant',
      );
    }
  }

  private assertConfigurationReady(): void {
    const config = loadBackupRestoreFoundationConfig();
    if (!config.defaults.retentionDays || config.defaults.retentionDays < 1) {
      throw new BadRequestException('Invalid retention configuration');
    }
  }

  private assertRbac(roles: string[], action: PermissionAction): void {
    if (!rolesCanAccessResource(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, action)) {
      throw new ForbiddenException(`Missing permission api.backupRestore:${action}`);
    }
  }

  private async assertLicense(tenantId: string): Promise<void> {
    const policy = await this.tenantPolicy.getAdvancedPolicy(tenantId);
    if (!policy.allowBackupRestore) {
      throw new ForbiddenException('License denied: allowBackupRestore=false');
    }
  }

  private assertCatalogType(typeId: string, kind: BackupRestoreJobKind): void {
    const entry = STATIC_BACKUP_RESTORE_CATALOG.find((e) => e.typeId === typeId);
    if (!entry) {
      throw new BadRequestException(`Unknown backup-restore typeId: ${typeId}`);
    }
    // Restore/verification may reference the same catalog typeId as the source adapter.
    if (kind === 'backup' && entry.registrationKind !== 'backupAdapter') {
      throw new BadRequestException(`typeId ${typeId} is not a backup adapter registration`);
    }
  }

  private assertRequiredMetadata(input: CreateBackupRestoreJobInput): void {
    if (!input.idempotencyKey?.trim()) {
      throw new BadRequestException('idempotencyKey is required');
    }
    if (!input.initiatedByUserId?.trim()) {
      throw new BadRequestException('initiatedByUserId is required');
    }
    if (input.kind === 'restore') {
      const snapshotId = input.metadata?.snapshotId;
      if (!snapshotId || typeof snapshotId !== 'string') {
        throw new BadRequestException('restore jobs require metadata.snapshotId');
      }
    }
  }

  private targetKeyFromMetadata(
    kind: BackupRestoreJobKind,
    metadata: BackupRestoreJobMetadata,
  ): string | null {
    if (kind === 'restore') {
      return metadata.snapshotId ? String(metadata.snapshotId) : null;
    }
    if (metadata.targetId) return String(metadata.targetId);
    return null;
  }
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}
