/**
 * Phase 42c — Import/Export Job domain (orchestration metadata only).
 * No business payload. No adapters.
 */

export type JobDirection = 'import' | 'export';

export type JobStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'completed'
  | 'completed_with_warnings'
  | 'cancelled'
  | 'failed'
  | 'retrying'
  | 'dead_letter'
  | 'expired';

export type JobPriority = 'low' | 'normal' | 'high' | 'critical';

export type JobFailureReason =
  | 'orchestration_error'
  | 'cancelled'
  | 'expired'
  | 'max_attempts_exceeded'
  | 'illegal_transition'
  | 'feature_disabled'
  | 'license_denied'
  | 'unknown';

export interface JobRetryPolicy {
  maxAttempts: number;
  /** Base delay in ms; exponential backoff applied by retry engine. */
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface JobCorrelation {
  correlationId: string;
  causationId?: string | null;
  traceId?: string | null;
}

/** Orchestration metadata only — never business rows or file contents. */
export interface JobMetadata {
  source: 'api' | 'system' | 'test';
  notes?: string;
  /** Test-only: force Null Executor to fail once for retry/DLQ coverage. */
  forceFailOnce?: boolean;
  [key: string]: unknown;
}

export interface ImportExportJob {
  id: string;
  tenantId: string;
  branchId: string | null;
  typeId: string;
  direction: JobDirection;
  status: JobStatus;
  priority: JobPriority;
  initiatedByUserId: string;
  idempotencyKey: string;
  correlationId: string;
  causationId: string | null;
  attemptCount: number;
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  lastError: string | null;
  failureReason: JobFailureReason | null;
  warningCount: number;
  metadata: JobMetadata;
  scheduledAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  deadLetteredAt: Date | null;
  expiresAt: Date | null;
  leasedAt: Date | null;
  leaseOwner: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ImportExportDeadLetterRecord {
  id: string;
  tenantId: string;
  jobId: string;
  reason: string;
  attempts: number;
  lastError: string | null;
  correlationId: string;
  createdAt: Date;
}

export const DEFAULT_JOB_RETRY_POLICY: JobRetryPolicy = {
  maxAttempts: 3,
  baseDelayMs: 1_000,
  maxDelayMs: 60_000,
};

/** Default TTL: 7 days from creation. */
export const DEFAULT_JOB_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const IMPORT_EXPORT_JOB_QUEUE_JOB_NAME = 'process-import-export-job';
