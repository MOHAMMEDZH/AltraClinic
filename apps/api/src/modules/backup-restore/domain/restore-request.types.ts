/**
 * Phase 43a — RestoreRequest entity (data shape only).
 */
import type { CorrelationContext, RestoreMode, TenantScopedId } from './value-objects';

export interface RestoreRequest extends TenantScopedId, CorrelationContext {
  readonly id: string;
  readonly snapshotId: string;
  readonly mode: RestoreMode;
  readonly justification: string | null;
  readonly requestedAt: Date;
  readonly approvedAt: Date | null;
  readonly approvedByUserId: string | null;
  readonly rejectedAt: Date | null;
}
