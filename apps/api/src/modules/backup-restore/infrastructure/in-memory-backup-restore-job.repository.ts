import { Injectable } from '@nestjs/common';
import type {
  BackupRestoreDeadLetterRecord,
  BackupRestoreJob,
  BackupRestoreJobStatus,
} from '../domain/job/backup-restore-job.types';
import { EMPTY_JOB_PROGRESS } from '../domain/job/backup-restore-job.types';
import type {
  BackupRestoreJobRepository,
  CreateBackupRestoreJobRecord,
  ListBackupRestoreJobsFilter,
} from '../application/ports/backup-restore-job.repository';
import { isActiveLockStatus } from '../domain/job/backup-restore-job-state-machine';

function cloneJob(job: BackupRestoreJob): BackupRestoreJob {
  return {
    ...job,
    metadata: { ...job.metadata },
    progress: { ...job.progress },
    transitions: job.transitions.map((t) => ({ ...t, at: new Date(t.at) })),
    scheduledAt: job.scheduledAt ? new Date(job.scheduledAt) : null,
    startedAt: job.startedAt ? new Date(job.startedAt) : null,
    completedAt: job.completedAt ? new Date(job.completedAt) : null,
    deadLetteredAt: job.deadLetteredAt ? new Date(job.deadLetteredAt) : null,
    expiresAt: job.expiresAt ? new Date(job.expiresAt) : null,
    leasedAt: job.leasedAt ? new Date(job.leasedAt) : null,
    createdAt: new Date(job.createdAt),
    updatedAt: new Date(job.updatedAt),
  };
}

/**
 * Phase 43b — in-memory job metadata store (no payloads, no cloud storage).
 */
@Injectable()
export class InMemoryBackupRestoreJobRepository implements BackupRestoreJobRepository {
  private readonly jobs = new Map<string, BackupRestoreJob>();
  private readonly deadLetters: BackupRestoreDeadLetterRecord[] = [];

  reset(): void {
    this.jobs.clear();
    this.deadLetters.length = 0;
  }

  async create(input: CreateBackupRestoreJobRecord): Promise<BackupRestoreJob> {
    const now = new Date();
    const job: BackupRestoreJob = {
      id: input.id,
      tenantId: input.tenantId,
      branchId: input.branchId,
      kind: input.kind,
      typeId: input.typeId,
      status: input.status,
      priority: input.priority as BackupRestoreJob['priority'],
      initiatedByUserId: input.initiatedByUserId,
      ownerUserId: input.ownerUserId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      attemptCount: input.attemptCount,
      maxAttempts: input.maxAttempts,
      baseDelayMs: input.baseDelayMs,
      maxDelayMs: input.maxDelayMs,
      lastError: null,
      failureClass: null,
      cancelReason: null,
      progress: { ...EMPTY_JOB_PROGRESS },
      metadata: { source: 'api', ...input.metadata } as BackupRestoreJob['metadata'],
      leasedAt: null,
      leaseOwner: null,
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      deadLetteredAt: null,
      expiresAt: input.expiresAt,
      transitions: [],
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return cloneJob(job);
  }

  async update(job: BackupRestoreJob): Promise<BackupRestoreJob> {
    const next = { ...job, updatedAt: new Date() };
    this.jobs.set(next.id, next);
    return cloneJob(next);
  }

  async findById(tenantId: string, jobId: string): Promise<BackupRestoreJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.tenantId !== tenantId) return null;
    return cloneJob(job);
  }

  async findByIdempotencyKey(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<BackupRestoreJob | null> {
    for (const job of this.jobs.values()) {
      if (job.tenantId === tenantId && job.idempotencyKey === idempotencyKey) {
        return cloneJob(job);
      }
    }
    return null;
  }

  async list(filter: ListBackupRestoreJobsFilter): Promise<BackupRestoreJob[]> {
    let rows = [...this.jobs.values()].filter((j) => j.tenantId === filter.tenantId);
    if (filter.branchId !== undefined && filter.branchId !== null) {
      rows = rows.filter((j) => j.branchId === filter.branchId);
    }
    if (filter.status) rows = rows.filter((j) => j.status === filter.status);
    if (filter.kind) rows = rows.filter((j) => j.kind === filter.kind);
    if (filter.typeId) rows = rows.filter((j) => j.typeId === filter.typeId);
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;
    return rows.slice(offset, offset + limit).map(cloneJob);
  }

  async countByStatus(
    tenantId?: string,
  ): Promise<Partial<Record<BackupRestoreJobStatus, number>>> {
    const counts: Partial<Record<BackupRestoreJobStatus, number>> = {};
    for (const job of this.jobs.values()) {
      if (tenantId && job.tenantId !== tenantId) continue;
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }

  async saveDeadLetter(
    record: Omit<BackupRestoreDeadLetterRecord, 'createdAt'> & { createdAt?: Date },
  ): Promise<BackupRestoreDeadLetterRecord> {
    const row: BackupRestoreDeadLetterRecord = {
      ...record,
      createdAt: record.createdAt ?? new Date(),
    };
    this.deadLetters.push(row);
    return { ...row };
  }

  async listDeadLetters(tenantId: string, limit = 50): Promise<BackupRestoreDeadLetterRecord[]> {
    return this.deadLetters
      .filter((d) => d.tenantId === tenantId)
      .slice(0, limit)
      .map((d) => ({ ...d }));
  }

  async findExpiredCandidates(now: Date, limit = 100): Promise<BackupRestoreJob[]> {
    const rows = [...this.jobs.values()].filter(
      (j) =>
        j.expiresAt !== null &&
        j.expiresAt.getTime() <= now.getTime() &&
        j.status !== 'expired' &&
        j.status !== 'cancelled' &&
        j.status !== 'dead_letter',
    );
    return rows.slice(0, limit).map(cloneJob);
  }

  async findActiveByKindTarget(
    tenantId: string,
    kind: BackupRestoreJob['kind'],
    targetKey: string,
  ): Promise<BackupRestoreJob[]> {
    return [...this.jobs.values()]
      .filter((j) => {
        if (j.tenantId !== tenantId || j.kind !== kind) return false;
        if (!isActiveLockStatus(j.status) && j.status !== 'queued' && j.status !== 'waiting') {
          return false;
        }
        const key =
          String(j.metadata.targetId ?? j.metadata.snapshotId ?? j.typeId ?? '');
        return key === targetKey;
      })
      .map(cloneJob);
  }
}
