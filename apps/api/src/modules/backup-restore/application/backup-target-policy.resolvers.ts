import { BadRequestException, Injectable } from '@nestjs/common';
import { STATIC_BACKUP_RESTORE_CATALOG } from '../catalog/static-backup-restore.catalog';
import type { TargetResolver } from './ports/services';
import type { ResolvedBackupTarget } from '../domain/backup/backup-engine.types';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import { loadBackupRestoreFoundationConfig } from '../config/backup-restore-config';
import type { BackupPolicySnapshot } from '../domain/backup/backup-engine.types';

/**
 * Phase 43c — resolve backup target from catalog + job metadata.
 */
@Injectable()
export class CatalogBackupTargetResolver implements TargetResolver {
  readonly contractVersion = '43c' as const;

  resolve(job: BackupRestoreJob): ResolvedBackupTarget {
    const entry = STATIC_BACKUP_RESTORE_CATALOG.find((e) => e.typeId === job.typeId);
    if (!entry) {
      throw new BadRequestException(`Unknown backup typeId: ${job.typeId}`);
    }
    const kind =
      job.typeId === 'postgres-logical'
        ? 'postgres'
        : job.typeId === 'media-prefix'
          ? 'media'
          : job.typeId === 'script-bridge'
            ? 'script_bridge'
            : 'custom';

    return {
      targetId: String(job.metadata.targetId ?? job.typeId),
      typeId: job.typeId,
      kind,
      displayName: entry.displayName,
      providerKey: entry.typeId,
    };
  }
}

@Injectable()
export class BackupPolicyLoader {
  load(job: BackupRestoreJob): BackupPolicySnapshot {
    const defaults = loadBackupRestoreFoundationConfig().defaults;
    return {
      policyId: job.metadata.policyId ? String(job.metadata.policyId) : null,
      retentionDays: defaults.retentionDays,
      compression: defaults.compression,
      encryptionClass:
        job.metadata.encryptionClass === 'none' ||
        job.metadata.encryptionClass === 'envelope' ||
        job.metadata.encryptionClass === 'kms'
          ? job.metadata.encryptionClass
          : defaults.encryptionClass,
      verifyAfterBackup: defaults.verifyAfterBackup,
      chunkSizeBytes: defaults.chunkSizeBytes,
    };
  }
}
