import type {
  ImportExportDeadLetterRecord,
  ImportExportJob,
  JobDirection,
  JobStatus,
} from '../../domain/job/import-export-job.types';

export const IMPORT_EXPORT_JOB_REPOSITORY = Symbol('IMPORT_EXPORT_JOB_REPOSITORY');

export interface CreateImportExportJobRecord {
  id: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  direction: JobDirection;
  status: JobStatus;
  priority: string;
  initiatedByUserId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  metadata: Record<string, unknown>;
  expiresAt: Date | null;
  scheduledAt: Date | null;
}

export interface ListImportExportJobsFilter {
  tenantId: string;
  branchId?: string | null;
  status?: JobStatus;
  typeId?: string;
  direction?: JobDirection;
  limit?: number;
  offset?: number;
}

export interface ImportExportJobRepository {
  create(job: CreateImportExportJobRecord): Promise<ImportExportJob>;
  update(job: ImportExportJob): Promise<ImportExportJob>;
  findById(tenantId: string, jobId: string): Promise<ImportExportJob | null>;
  findByIdempotencyKey(tenantId: string, idempotencyKey: string): Promise<ImportExportJob | null>;
  list(filter: ListImportExportJobsFilter): Promise<ImportExportJob[]>;
  countByStatus(tenantId?: string): Promise<Partial<Record<JobStatus, number>>>;
  saveDeadLetter(record: Omit<ImportExportDeadLetterRecord, 'createdAt'> & { createdAt?: Date }): Promise<ImportExportDeadLetterRecord>;
  listDeadLetters(tenantId: string, limit?: number): Promise<ImportExportDeadLetterRecord[]>;
  findExpiredCandidates(now: Date, limit?: number): Promise<ImportExportJob[]>;
}
