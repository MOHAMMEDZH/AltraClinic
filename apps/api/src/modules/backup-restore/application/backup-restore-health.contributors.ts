/**
 * Phase 43a — Health contributor definitions only.
 * No live probes beyond foundation health endpoint.
 */
import { BACKUP_RESTORE_HEALTH_CONTRIBUTORS } from '../backup-restore.constants';
import { loadBackupRestoreFoundationConfig } from '../config/backup-restore-config';

export type BackupRestoreHealthContributorId =
  (typeof BACKUP_RESTORE_HEALTH_CONTRIBUTORS)[number];

export interface BackupRestoreHealthContributorDefinition {
  id: BackupRestoreHealthContributorId;
  /** Always not_configured / dormant in 43a (no adapters). */
  status: 'not_configured' | 'dormant';
  description: string;
}

export class BackupRestoreHealthContributors {
  listDefinitions(): readonly BackupRestoreHealthContributorDefinition[] {
    const dormant = !loadBackupRestoreFoundationConfig().featureEnabled;
    const status = dormant ? 'dormant' : 'not_configured';
    return BACKUP_RESTORE_HEALTH_CONTRIBUTORS.map((id) => ({
      id,
      status,
      description: `Phase 43a definition for ${id} (no runtime probe)`,
    }));
  }
}
