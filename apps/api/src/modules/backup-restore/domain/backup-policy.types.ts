/**
 * Phase 43a — BackupPolicy entity (data shape only).
 */
import type { CompressionAlgorithm, EncryptionClass, TenantScopedId } from './value-objects';

export interface BackupPolicy extends TenantScopedId {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly targetIds: readonly string[];
  readonly retentionPolicyId: string;
  readonly cadenceCron: string | null;
  readonly encryptionClass: EncryptionClass;
  readonly compression: CompressionAlgorithm;
  readonly maxConcurrentJobs: number;
  readonly verifyAfterBackup: boolean;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
