/**
 * Phase 43a — BackupVerification entity (data shape only).
 */
import type { TenantScopedId, VerificationStatus } from './value-objects';

export interface BackupVerification extends TenantScopedId {
  readonly id: string;
  readonly snapshotId: string;
  readonly backupJobId: string | null;
  readonly status: VerificationStatus;
  readonly checksumExpected: string | null;
  readonly checksumActual: string | null;
  readonly startedAt: Date | null;
  readonly completedAt: Date | null;
  readonly details: Readonly<Record<string, unknown>>;
}
