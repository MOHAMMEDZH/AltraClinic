import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type {
  BackupManifest,
  BackupPolicySnapshot,
  BackupSnapshotRecord,
  ResolvedBackupTarget,
} from '../domain/backup/backup-engine.types';
import {
  BACKUP_MANIFEST_SCHEMA_VERSION,
} from '../domain/backup/backup-engine.types';
import type { CollectedBackupPayload } from './backup-data.collector';
import type { CompressionResult, EncryptionResult } from './backup-compression-encryption.orchestrators';

@Injectable()
export class BackupSnapshotBuilder {
  buildManifest(input: {
    job: BackupRestoreJob;
    snapshotId: string;
    payload: CollectedBackupPayload;
    compression: CompressionResult;
    encryption: EncryptionResult;
  }): BackupManifest {
    const entityCounts: Record<string, number> = {};
    for (const resource of input.payload.resources) {
      entityCounts[resource.resourceType] =
        (entityCounts[resource.resourceType] ?? 0) + resource.entityCount;
    }
    return {
      schemaVersion: BACKUP_MANIFEST_SCHEMA_VERSION,
      backupJobId: input.job.id,
      snapshotId: input.snapshotId,
      tenantId: input.job.tenantId,
      typeId: input.job.typeId,
      createdAt: new Date().toISOString(),
      resources: input.payload.resources,
      entityCounts,
      compression: input.compression.algorithm,
      encryptionClass: input.encryption.encryptionClass,
      encryptionAlgorithm: input.encryption.algorithm,
      keyReference: input.encryption.keyReference,
      keyVersion: input.encryption.keyVersion,
      metadata: {
        correlationId: input.job.correlationId,
        targetId: input.payload.target.targetId,
        collectedAt: input.payload.collectedAt,
      },
    };
  }

  buildSnapshot(input: {
    job: BackupRestoreJob;
    target: ResolvedBackupTarget;
    policy: BackupPolicySnapshot;
    manifest: BackupManifest;
    storageKey: string;
    storageProvider: string;
    checksumSha256: string;
    sizeBytes: number;
    compression: CompressionResult;
    encryption: EncryptionResult;
    recoveryPointId: string;
  }): BackupSnapshotRecord {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + input.policy.retentionDays * 24 * 60 * 60 * 1000,
    );
    return {
      id: input.manifest.snapshotId,
      backupJobId: input.job.id,
      tenantId: input.job.tenantId,
      branchId: input.job.branchId,
      recoveryPointId: input.recoveryPointId,
      checksumSha256: input.checksumSha256,
      sizeBytes: input.sizeBytes,
      encryptionClass: input.encryption.encryptionClass,
      compression: input.compression.algorithm,
      storageKey: input.storageKey,
      storageProvider: input.storageProvider,
      manifest: input.manifest,
      verificationStatus: input.policy.verifyAfterBackup ? 'pending' : 'skipped',
      createdAt: now,
      expiresAt,
    };
  }

  newSnapshotId(): string {
    return randomUUID();
  }

  newRecoveryPointId(): string {
    return randomUUID();
  }
}
