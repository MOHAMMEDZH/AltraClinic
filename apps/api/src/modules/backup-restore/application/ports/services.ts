/**
 * Phase 43a–43e — service contracts.
 * 43a: markers only. 43c: BackupExecutor. 43d: Verification/Retention. 43e: RestoreExecutor.
 */

export const BACKUP_SERVICE = Symbol('BACKUP_SERVICE');
export const RESTORE_SERVICE = Symbol('RESTORE_SERVICE');
export const VERIFICATION_SERVICE = Symbol('VERIFICATION_SERVICE');
export const RETENTION_SERVICE = Symbol('RETENTION_SERVICE');
export const ENCRYPTION_SERVICE = Symbol('ENCRYPTION_SERVICE');
export const COMPRESSION_SERVICE = Symbol('COMPRESSION_SERVICE');
export const TARGET_RESOLVER = Symbol('TARGET_RESOLVER');

export interface BackupService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface RestoreService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface VerificationService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface RetentionService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface EncryptionService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface CompressionService {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}

export interface TargetResolver {
  readonly contractVersion: '43a' | '43c' | '43d' | '43e';
}
