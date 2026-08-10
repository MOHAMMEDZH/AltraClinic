import { Injectable } from '@nestjs/common';
import type { BackupRestoreJob } from '../domain/job/backup-restore-job.types';
import type { BackupSnapshotRecord } from '../domain/backup/backup-engine.types';
import type { RestoreValidationResult } from '../domain/restore/restore-engine.types';
import { BackupManifestValidator } from './backup-manifest.validator';
import {
  isBackupRestoreCenterEnabled,
  loadBackupRestoreFoundationConfig,
} from '../config/backup-restore-config';
import type { BackupStoragePort } from './ports/backup-storage.port';

export interface RestorePreflightInput {
  job: BackupRestoreJob;
  snapshot: BackupSnapshotRecord;
  storage: BackupStoragePort;
  allowBackupRestore: boolean;
  hasManagePermission: boolean;
}

/**
 * Phase 43e — pre-restore validation.
 * Only VERIFIED snapshots may proceed.
 */
@Injectable()
export class RestoreValidator {
  readonly ready = true;
  readonly contractVersion = '43e' as const;

  constructor(private readonly manifests: BackupManifestValidator) {}

  async validate(input: RestorePreflightInput): Promise<RestoreValidationResult> {
    const reasons: string[] = [];
    const config = loadBackupRestoreFoundationConfig();

    const featureFlagsOk =
      isBackupRestoreCenterEnabled() &&
      (config.flags.restoreEnabled || config.flags.centerEnabled);
    if (!featureFlagsOk) {
      reasons.push('Feature flags deny restore (BACKUP_RESTORE_CENTER_ENABLED / BACKUP_RESTORE_ENABLED)');
    }

    const licenseOk = input.allowBackupRestore === true;
    if (!licenseOk) {
      reasons.push('Tenant license gate allowBackupRestore=false');
    }

    const permissionsOk = input.hasManagePermission === true;
    if (!permissionsOk) {
      reasons.push('Missing restore manage permission');
    }

    const tenantOwnershipOk = input.snapshot.tenantId === input.job.tenantId;
    if (!tenantOwnershipOk) {
      reasons.push('Snapshot tenant ownership mismatch');
    }

    const verificationStatusOk = input.snapshot.verificationStatus === 'passed';
    if (!verificationStatusOk) {
      reasons.push(
        `Snapshot verificationStatus=${input.snapshot.verificationStatus}; only verified snapshots may be restored`,
      );
    }

    const manifestCheck = this.manifests.validate(input.snapshot, input.job.tenantId);
    const manifestOk = manifestCheck.valid;
    if (!manifestOk) {
      reasons.push(...manifestCheck.issues.map((i) => i.message));
    }

    const storageAvailable = await input.storage.exists(input.snapshot.storageKey);
    if (!storageAvailable) {
      reasons.push('Storage object missing for snapshot');
    }

    const mode =
      input.job.metadata.restoreMode === 'controlled' ? 'controlled' : 'drill';
    let restorePolicyOk = true;
    if (mode === 'controlled' && config.defaults.dualControlRestore) {
      const approver =
        typeof input.job.metadata.approvedByUserId === 'string'
          ? input.job.metadata.approvedByUserId.trim()
          : '';
      if (!approver) {
        restorePolicyOk = false;
        reasons.push('Controlled restore requires approvedByUserId (dual-control)');
      } else if (approver === input.job.initiatedByUserId) {
        restorePolicyOk = false;
        reasons.push('Dual-control violation: approver must differ from requester');
      }
    }

    const valid =
      featureFlagsOk &&
      licenseOk &&
      permissionsOk &&
      tenantOwnershipOk &&
      verificationStatusOk &&
      manifestOk &&
      storageAvailable &&
      restorePolicyOk;

    return {
      valid,
      licenseOk,
      permissionsOk,
      featureFlagsOk,
      tenantOwnershipOk,
      verificationStatusOk,
      manifestOk,
      storageAvailable,
      restorePolicyOk,
      reasons,
    };
  }
}
