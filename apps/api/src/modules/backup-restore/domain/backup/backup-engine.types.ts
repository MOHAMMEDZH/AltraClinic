/**
 * Phase 43c — Backup Engine domain types (pipeline / snapshot / manifest).
 * Additive to 43a entity shapes. No restore / verify execution types beyond requests.
 */

import type { CompressionAlgorithm, EncryptionClass, VerificationStatus } from '../value-objects';

export const BACKUP_PIPELINE_STAGES = [
  'validate_job',
  'load_policy',
  'resolve_target',
  'prepare_snapshot',
  'collect_data',
  'compress',
  'encrypt',
  'write_backup',
  'generate_manifest',
  'register_snapshot',
  'queue_verification_request',
  'finalize_job',
] as const;

export type BackupPipelineStage = (typeof BACKUP_PIPELINE_STAGES)[number];

export interface BackupManifestResource {
  resourceType: string;
  resourceId: string;
  version: string;
  entityCount: number;
}

export interface BackupManifest {
  schemaVersion: string;
  backupJobId: string;
  snapshotId: string;
  tenantId: string;
  typeId: string;
  createdAt: string;
  resources: readonly BackupManifestResource[];
  entityCounts: Readonly<Record<string, number>>;
  compression: CompressionAlgorithm;
  encryptionClass: EncryptionClass;
  encryptionAlgorithm: string | null;
  keyReference: string | null;
  keyVersion: string | null;
  metadata: Readonly<Record<string, unknown>>;
}

export interface BackupSnapshotRecord {
  id: string;
  backupJobId: string;
  tenantId: string;
  branchId: string | null;
  recoveryPointId: string | null;
  checksumSha256: string;
  sizeBytes: number;
  encryptionClass: EncryptionClass;
  compression: CompressionAlgorithm;
  storageKey: string;
  storageProvider: string;
  manifest: BackupManifest;
  verificationStatus: VerificationStatus;
  createdAt: Date;
  expiresAt: Date | null;
}

export interface BackupVerificationRequest {
  id: string;
  tenantId: string;
  branchId: string | null;
  snapshotId: string;
  backupJobId: string;
  /** 43c creates `pending`; 43d may advance lifecycle (no deletion). */
  status: 'pending' | 'running' | 'verified' | 'verification_failed' | 'expired' | 'corrupted' | 'unknown';
  checksumExpected: string;
  createdAt: Date;
  details: Readonly<Record<string, unknown>>;
}

export interface BackupPolicySnapshot {
  policyId: string | null;
  retentionDays: number;
  compression: CompressionAlgorithm;
  encryptionClass: EncryptionClass;
  verifyAfterBackup: boolean;
  chunkSizeBytes: number;
}

export interface ResolvedBackupTarget {
  targetId: string;
  typeId: string;
  kind: 'postgres' | 'media' | 'script_bridge' | 'custom';
  displayName: string;
  providerKey: string;
}

export const BACKUP_MANIFEST_SCHEMA_VERSION = '43c.1';
