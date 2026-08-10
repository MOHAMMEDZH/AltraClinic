/**
 * Phase 43a — BackupSnapshot entity (artifact metadata only; no bytes).
 */
import type { CompressionAlgorithm, EncryptionClass, TenantScopedId } from './value-objects';

export interface BackupSnapshot extends TenantScopedId {
  readonly id: string;
  readonly backupJobId: string;
  readonly recoveryPointId: string | null;
  readonly checksumSha256: string | null;
  readonly sizeBytes: number | null;
  readonly encryptionClass: EncryptionClass;
  readonly compression: CompressionAlgorithm;
  /** Storage key/URI metadata only — never a local FS path leak contract. */
  readonly storageKey: string | null;
  readonly createdAt: Date;
  readonly expiresAt: Date | null;
}
