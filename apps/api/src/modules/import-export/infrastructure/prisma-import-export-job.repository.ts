import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/prisma.service';
import type {
  ImportExportDeadLetterRecord,
  ImportExportJob,
  JobDirection,
  JobFailureReason,
  JobMetadata,
  JobPriority,
  JobStatus,
} from '../../domain/job/import-export-job.types';
import type {
  CreateImportExportJobRecord,
  ImportExportJobRepository,
  ListImportExportJobsFilter,
} from '../../application/ports/import-export-job.repository';

function mapJob(row: {
  id: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  direction: string;
  status: string;
  priority: string;
  initiatedByUserId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  lastError: string | null;
  failureReason: string | null;
  warningCount: number;
  metadata: Prisma.JsonValue;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
  expiresAt: Date | null;
  leasedAt: Date | null;
  leaseOwner: string | null;
  createdAt: Date;
  updatedAt: Date;
}): ImportExportJob {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    typeId: row.typeId,
    direction: row.direction as JobDirection,
    status: row.status as JobStatus,
    priority: row.priority as JobPriority,
    initiatedByUserId: row.initiatedByUserId,
    idempotencyKey: row.idempotencyKey,
    correlationId: row.correlationId,
    causationId: row.causationId,
    attemptCount: row.attemptCount,
    maxAttempts: row.maxAttempts,
    baseDelayMs: row.baseDelayMs,
    maxDelayMs: row.maxDelayMs,
    lastError: row.lastError,
    failureReason: (row.failureReason as JobFailureReason | null) ?? null,
    warningCount: row.warningCount,
    metadata: (row.metadata as JobMetadata) ?? { source: 'api' },
    scheduledAt: row.scheduledAt,
    startedAt: row.startedAt,
    completedAt: row.completedAt,
    deadLetteredAt: row.deadLetteredAt,
    expiresAt: row.expiresAt,
    leasedAt: row.leasedAt,
    leaseOwner: row.leaseOwner,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
export class PrismaImportExportJobRepository implements ImportExportJobRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateImportExportJobRecord): Promise<ImportExportJob> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const row = await tx.importExportJob.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          branchId: input.branchId,
          typeId: input.typeId,
          direction: input.direction,
          status: input.status,
          priority: input.priority,
          initiatedByUserId: input.initiatedByUserId,
          idempotencyKey: input.idempotencyKey,
          correlationId: input.correlationId,
          causationId: input.causationId,
          attemptCount: input.attemptCount,
          maxAttempts: input.maxAttempts,
          baseDelayMs: input.baseDelayMs,
          maxDelayMs: input.maxDelayMs,
          metadata: input.metadata as Prisma.InputJsonValue,
          expiresAt: input.expiresAt,
          scheduledAt: input.scheduledAt,
        },
      });
      return mapJob(row);
    });
  }

  async update(job: ImportExportJob): Promise<ImportExportJob> {
    return this.prisma.withTenantContext(job.tenantId, async (tx) => {
      const row = await tx.importExportJob.update({
        where: { id: job.id },
        data: {
          status: job.status,
          attemptCount: job.attemptCount,
          lastError: job.lastError,
          failureReason: job.failureReason,
          warningCount: job.warningCount,
          metadata: job.metadata as Prisma.InputJsonValue,
          scheduledAt: job.scheduledAt,
          startedAt: job.startedAt,
          completedAt: job.completedAt,
          deadLetteredAt: job.deadLetteredAt,
          expiresAt: job.expiresAt,
          leasedAt: job.leasedAt,
          leaseOwner: job.leaseOwner,
        },
      });
      return mapJob(row);
    });
  }

  async findById(tenantId: string, jobId: string): Promise<ImportExportJob | null> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const row = await tx.importExportJob.findFirst({
        where: { id: jobId, tenantId },
      });
      return row ? mapJob(row) : null;
    });
  }

  async findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<ImportExportJob | null> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const row = await tx.importExportJob.findUnique({
        where: { tenantId_idempotencyKey: { tenantId, idempotencyKey } },
      });
      return row ? mapJob(row) : null;
    });
  }

  async list(filter: ListImportExportJobsFilter): Promise<ImportExportJob[]> {
    return this.prisma.withTenantContext(filter.tenantId, async (tx) => {
      const rows = await tx.importExportJob.findMany({
        where: {
          tenantId: filter.tenantId,
          ...(filter.branchId ? { branchId: filter.branchId } : {}),
          ...(filter.status ? { status: filter.status } : {}),
          ...(filter.typeId ? { typeId: filter.typeId } : {}),
          ...(filter.direction ? { direction: filter.direction } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: filter.limit ?? 50,
        skip: filter.offset ?? 0,
      });
      return rows.map(mapJob);
    });
  }

  async countByStatus(tenantId?: string): Promise<Partial<Record<JobStatus, number>>> {
    if (tenantId) {
      return this.prisma.withTenantContext(tenantId, async (tx) => {
        const groups = await tx.importExportJob.groupBy({
          by: ['status'],
          where: { tenantId },
          _count: { _all: true },
        });
        const counts: Partial<Record<JobStatus, number>> = {};
        for (const g of groups) {
          counts[g.status as JobStatus] = g._count._all;
        }
        return counts;
      });
    }
    return this.prisma.withPlatformBypass(async (tx) => {
      const delegate = (tx as { importExportJob?: { groupBy: Function } }).importExportJob;
      if (!delegate?.groupBy) {
        return {};
      }
      const groups = await delegate.groupBy({
        by: ['status'],
        _count: { _all: true },
      });
      const counts: Partial<Record<JobStatus, number>> = {};
      for (const g of groups as Array<{ status: string; _count: { _all: number } }>) {
        counts[g.status as JobStatus] = g._count._all;
      }
      return counts;
    });
  }

  async saveDeadLetter(
    record: Omit<ImportExportDeadLetterRecord, 'createdAt'> & { createdAt?: Date },
  ): Promise<ImportExportDeadLetterRecord> {
    return this.prisma.withTenantContext(record.tenantId, async (tx) => {
      const row = await tx.importExportDeadLetter.create({
        data: {
          id: record.id,
          tenantId: record.tenantId,
          jobId: record.jobId,
          reason: record.reason,
          attempts: record.attempts,
          lastError: record.lastError,
          correlationId: record.correlationId,
          createdAt: record.createdAt,
        },
      });
      return {
        id: row.id,
        tenantId: row.tenantId,
        jobId: row.jobId,
        reason: row.reason,
        attempts: row.attempts,
        lastError: row.lastError,
        correlationId: row.correlationId,
        createdAt: row.createdAt,
      };
    });
  }

  async listDeadLetters(tenantId: string, limit = 50): Promise<ImportExportDeadLetterRecord[]> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.importExportDeadLetter.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });
      return rows.map((row) => ({
        id: row.id,
        tenantId: row.tenantId,
        jobId: row.jobId,
        reason: row.reason,
        attempts: row.attempts,
        lastError: row.lastError,
        correlationId: row.correlationId,
        createdAt: row.createdAt,
      }));
    });
  }

  async findExpiredCandidates(now: Date, limit = 100): Promise<ImportExportJob[]> {
    return this.prisma.withPlatformBypass(async (tx) => {
      const rows = await tx.importExportJob.findMany({
        where: {
          expiresAt: { lte: now },
          status: { notIn: ['expired', 'dead_letter', 'cancelled'] },
        },
        take: limit,
      });
      return rows.map(mapJob);
    });
  }
}
