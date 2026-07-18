import { Injectable } from '@nestjs/common';
import type {
  ImportExportDeadLetterRecord,
  ImportExportJob,
  JobStatus,
} from '../domain/job/import-export-job.types';
import type {
  CreateImportExportJobRecord,
  ImportExportJobRepository,
  ListImportExportJobsFilter,
} from '../application/ports/import-export-job.repository';

function cloneJob(job: ImportExportJob): ImportExportJob {
  return {
    ...job,
    metadata: { ...job.metadata },
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
 * In-memory job store for unit/integration tests (no business data).
 */
@Injectable()
export class InMemoryImportExportJobRepository implements ImportExportJobRepository {
  private readonly jobs = new Map<string, ImportExportJob>();
  private readonly deadLetters: ImportExportDeadLetterRecord[] = [];

  async create(input: CreateImportExportJobRecord): Promise<ImportExportJob> {
    const now = new Date();
    const job: ImportExportJob = {
      id: input.id,
      tenantId: input.tenantId,
      branchId: input.branchId,
      typeId: input.typeId,
      direction: input.direction,
      status: input.status,
      priority: input.priority as ImportExportJob['priority'],
      initiatedByUserId: input.initiatedByUserId,
      idempotencyKey: input.idempotencyKey,
      correlationId: input.correlationId,
      causationId: input.causationId,
      attemptCount: input.attemptCount,
      maxAttempts: input.maxAttempts,
      baseDelayMs: input.baseDelayMs,
      maxDelayMs: input.maxDelayMs,
      lastError: null,
      failureReason: null,
      warningCount: 0,
      metadata: { source: 'api', ...input.metadata } as ImportExportJob['metadata'],
      scheduledAt: input.scheduledAt,
      startedAt: null,
      completedAt: null,
      deadLetteredAt: null,
      expiresAt: input.expiresAt,
      leasedAt: null,
      leaseOwner: null,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(job.id, job);
    return cloneJob(job);
  }

  async update(job: ImportExportJob): Promise<ImportExportJob> {
    const next = { ...job, updatedAt: new Date() };
    this.jobs.set(next.id, next);
    return cloneJob(next);
  }

  async findById(tenantId: string, jobId: string): Promise<ImportExportJob | null> {
    const job = this.jobs.get(jobId);
    if (!job || job.tenantId !== tenantId) return null;
    return cloneJob(job);
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<ImportExportJob | null> {
    for (const job of this.jobs.values()) {
      if (job.tenantId === tenantId && job.idempotencyKey === idempotencyKey) {
        return cloneJob(job);
      }
    }
    return null;
  }

  async list(filter: ListImportExportJobsFilter): Promise<ImportExportJob[]> {
    let rows = [...this.jobs.values()].filter((j) => j.tenantId === filter.tenantId);
    if (filter.branchId !== undefined && filter.branchId !== null) {
      rows = rows.filter((j) => j.branchId === filter.branchId);
    }
    if (filter.status) rows = rows.filter((j) => j.status === filter.status);
    if (filter.typeId) rows = rows.filter((j) => j.typeId === filter.typeId);
    if (filter.direction) rows = rows.filter((j) => j.direction === filter.direction);
    rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 50;
    return rows.slice(offset, offset + limit).map(cloneJob);
  }

  async countByStatus(tenantId?: string): Promise<Partial<Record<JobStatus, number>>> {
    const counts: Partial<Record<JobStatus, number>> = {};
    for (const job of this.jobs.values()) {
      if (tenantId && job.tenantId !== tenantId) continue;
      counts[job.status] = (counts[job.status] ?? 0) + 1;
    }
    return counts;
  }

  async saveDeadLetter(
    record: Omit<ImportExportDeadLetterRecord, 'createdAt'> & { createdAt?: Date },
  ): Promise<ImportExportDeadLetterRecord> {
    const saved: ImportExportDeadLetterRecord = {
      ...record,
      createdAt: record.createdAt ?? new Date(),
    };
    this.deadLetters.push(saved);
    return { ...saved };
  }

  async listDeadLetters(tenantId: string, limit = 50): Promise<ImportExportDeadLetterRecord[]> {
    return this.deadLetters
      .filter((d) => d.tenantId === tenantId)
      .slice(-limit)
      .map((d) => ({ ...d }));
  }

  async findExpiredCandidates(now: Date, limit = 100): Promise<ImportExportJob[]> {
    return [...this.jobs.values()]
      .filter(
        (j) =>
          j.expiresAt &&
          j.expiresAt.getTime() <= now.getTime() &&
          j.status !== 'expired' &&
          j.status !== 'dead_letter' &&
          j.status !== 'cancelled',
      )
      .slice(0, limit)
      .map(cloneJob);
  }

  reset(): void {
    this.jobs.clear();
    this.deadLetters.length = 0;
  }
}
