/**
 * Phase 43a — BackupJob entity (data shape only).
 */
import type { BackupJobStatus, CorrelationContext, TenantScopedId } from './value-objects';

export interface BackupJob extends TenantScopedId, CorrelationContext {
  readonly id: string;
  readonly policyId: string | null;
  readonly targetId: string;
  readonly status: BackupJobStatus;
  readonly snapshotId: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly failureReason: string | null;
  readonly metadata: Readonly<Record<string, unknown>>;
}
