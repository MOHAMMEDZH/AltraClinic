/**
 * Phase 43a — domain value objects (types only, no behavior).
 */

export type BackupJobStatus =
  | 'queued'
  | 'running'
  | 'verifying'
  | 'succeeded'
  | 'failed'
  | 'cancelled'
  | 'dead_letter'
  | 'expired';

export type RestoreJobStatus =
  | 'queued'
  | 'pending_approval'
  | 'approved'
  | 'running'
  | 'validating'
  | 'succeeded'
  | 'failed'
  | 'cancelled';

export type RestoreMode = 'drill' | 'controlled';

export type BackupTargetKind = 'postgres' | 'media' | 'script_bridge' | 'custom';

export type EncryptionClass = 'none' | 'envelope' | 'kms';

export type CompressionAlgorithm = 'none' | 'gzip' | 'zstd';

export type VerificationStatus = 'pending' | 'passed' | 'failed' | 'skipped';

export type RetentionUnit = 'days' | 'weeks' | 'months';

export interface TenantScopedId {
  readonly tenantId: string;
  readonly branchId?: string | null;
}

export interface CorrelationContext {
  readonly correlationId: string;
  readonly requestedByUserId?: string | null;
}
