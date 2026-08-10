/**
 * Phase 43a — RecoveryPoint entity (data shape only).
 */
import type { TenantScopedId } from './value-objects';

export interface RecoveryPoint extends TenantScopedId {
  readonly id: string;
  readonly snapshotId: string;
  readonly label: string | null;
  readonly capturedAt: Date;
  readonly rpoSeconds: number | null;
  readonly verified: boolean;
}
