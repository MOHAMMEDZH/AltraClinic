/**
 * Phase 43a — RestoreJob entity (data shape only).
 */
import type {
  CorrelationContext,
  RestoreJobStatus,
  RestoreMode,
  TenantScopedId,
} from './value-objects';

export interface RestoreJob extends TenantScopedId, CorrelationContext {
  readonly id: string;
  readonly snapshotId: string;
  readonly restoreRequestId: string | null;
  readonly mode: RestoreMode;
  readonly status: RestoreJobStatus;
  readonly approvedByUserId: string | null;
  readonly targetEnvironment: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly completedAt: Date | null;
  readonly failureReason: string | null;
}
