import { Injectable } from '@nestjs/common';
import {
  BACKUP_MANIFEST_SCHEMA_VERSION,
  type BackupManifest,
  type BackupSnapshotRecord,
} from '../domain/backup/backup-engine.types';
import type {
  ManifestValidationIssue,
  ManifestValidationResult,
} from '../domain/verification/verification-retention.types';

/**
 * Phase 43d — manifest + integrity validators (no restore validation).
 */
@Injectable()
export class BackupManifestValidator {
  readonly ready = true;

  validate(
    snapshot: BackupSnapshotRecord,
    expectedTenantId: string,
  ): ManifestValidationResult {
    const issues: ManifestValidationIssue[] = [];
    const manifest = snapshot.manifest;

    if (!manifest) {
      return {
        valid: false,
        issues: [{ code: 'manifest_missing', message: 'Snapshot manifest is missing' }],
        schemaVersion: null,
        manifest: null,
      };
    }

    if (manifest.schemaVersion !== BACKUP_MANIFEST_SCHEMA_VERSION) {
      issues.push({
        code: 'schema_version_mismatch',
        message: `Expected schema ${BACKUP_MANIFEST_SCHEMA_VERSION}, got ${manifest.schemaVersion}`,
        field: 'schemaVersion',
      });
    }
    if (manifest.snapshotId !== snapshot.id) {
      issues.push({
        code: 'snapshot_id_mismatch',
        message: 'Manifest snapshotId does not match snapshot',
        field: 'snapshotId',
      });
    }
    if (manifest.backupJobId !== snapshot.backupJobId) {
      issues.push({
        code: 'backup_job_mismatch',
        message: 'Manifest backupJobId does not match snapshot',
        field: 'backupJobId',
      });
    }
    if (manifest.tenantId !== expectedTenantId || snapshot.tenantId !== expectedTenantId) {
      issues.push({
        code: 'tenant_ownership',
        message: 'Tenant ownership mismatch',
        field: 'tenantId',
      });
    }
    if (!Array.isArray(manifest.resources) || manifest.resources.length === 0) {
      issues.push({
        code: 'resource_inventory_empty',
        message: 'Manifest resource inventory is empty',
        field: 'resources',
      });
    }
    if (!manifest.entityCounts || typeof manifest.entityCounts !== 'object') {
      issues.push({
        code: 'entity_counts_missing',
        message: 'Manifest entityCounts missing',
        field: 'entityCounts',
      });
    }
    if (manifest.compression !== snapshot.compression) {
      issues.push({
        code: 'compression_mismatch',
        message: 'Compression metadata mismatch',
        field: 'compression',
      });
    }
    if (manifest.encryptionClass !== snapshot.encryptionClass) {
      issues.push({
        code: 'encryption_mismatch',
        message: 'Encryption metadata mismatch',
        field: 'encryptionClass',
      });
    }
    if (!snapshot.recoveryPointId) {
      issues.push({
        code: 'recovery_point_missing',
        message: 'Recovery point is required',
        field: 'recoveryPointId',
      });
    }
    if (!snapshot.storageKey?.trim()) {
      issues.push({
        code: 'storage_reference_missing',
        message: 'Storage reference missing',
        field: 'storageKey',
      });
    }

    return {
      valid: issues.length === 0,
      issues,
      schemaVersion: manifest.schemaVersion,
      manifest,
    };
  }

  validateChecksum(expected: string, actual: string): ManifestValidationIssue | null {
    if (!expected || !actual) {
      return { code: 'checksum_missing', message: 'Checksum missing' };
    }
    if (expected.toLowerCase() !== actual.toLowerCase()) {
      return {
        code: 'checksum_mismatch',
        message: 'Snapshot checksum does not match stored object',
        field: 'checksumSha256',
      };
    }
    return null;
  }

  validateEncryptionMetadata(manifest: BackupManifest, snapshot: BackupSnapshotRecord): ManifestValidationIssue[] {
    const issues: ManifestValidationIssue[] = [];
    if (snapshot.encryptionClass === 'none') return issues;
    if (!manifest.encryptionAlgorithm) {
      issues.push({
        code: 'encryption_algorithm_missing',
        message: 'Encryption algorithm metadata missing',
        field: 'encryptionAlgorithm',
      });
    }
    if (!manifest.keyReference) {
      issues.push({
        code: 'key_reference_missing',
        message: 'Encryption key reference missing',
        field: 'keyReference',
      });
    }
    return issues;
  }

  validateCompressionMetadata(manifest: BackupManifest, snapshot: BackupSnapshotRecord): ManifestValidationIssue[] {
    if (manifest.compression !== snapshot.compression) {
      return [
        {
          code: 'compression_metadata_invalid',
          message: 'Compression metadata invalid',
          field: 'compression',
        },
      ];
    }
    if (manifest.compression !== 'gzip' && manifest.compression !== 'none' && manifest.compression !== 'zstd') {
      return [
        {
          code: 'compression_unsupported',
          message: `Unsupported compression ${manifest.compression}`,
          field: 'compression',
        },
      ];
    }
    return [];
  }
}
