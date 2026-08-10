/**
 * Phase 43c — Backup storage abstraction (provider interfaces).
 * No cloud SDK wiring; filesystem/memory providers only.
 */
export const BACKUP_STORAGE = Symbol('BACKUP_STORAGE');

export type BackupStorageProviderKind =
  | 'filesystem'
  | 's3'
  | 'azure_blob'
  | 'gcs'
  | 'custom'
  | 'memory';

export interface BackupStoragePutInput {
  storageKey: string;
  body: Buffer;
  contentType?: string;
  metadata?: Record<string, string>;
}

export interface BackupStorageObject {
  storageKey: string;
  sizeBytes: number;
  etag?: string;
}

/**
 * Port only — implementations: memory (default tests), filesystem (local durable path).
 * S3 / Azure / GCS remain interface-capable via kind metadata (no SDKs in 43c).
 */
export interface BackupStoragePort {
  readonly providerKind: BackupStorageProviderKind;
  put(input: BackupStoragePutInput): Promise<BackupStorageObject>;
  exists(storageKey: string): Promise<boolean>;
  /** Read used for orchestration tests only — not a restore engine. */
  get(storageKey: string): Promise<Buffer | null>;
}
