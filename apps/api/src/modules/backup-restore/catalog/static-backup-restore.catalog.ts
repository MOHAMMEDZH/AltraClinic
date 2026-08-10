/**
 * Phase 43a — static catalog baseline (parity only; never runtime authority).
 * All entries disabled / non-executable. No adapters.
 */
import type { BackupRestoreRegistrationMetadata } from '../domain/backup-restore-registration.contracts';
import { BACKUP_RESTORE_CENTER_ENABLED_ENV } from '../backup-restore.constants';

export const STATIC_BACKUP_RESTORE_CATALOG: readonly BackupRestoreRegistrationMetadata[] = [
  {
    typeId: 'postgres-logical',
    displayName: 'PostgreSQL logical backup',
    category: 'database',
    ownerModule: 'platform',
    registrationKind: 'backupAdapter',
    status: 'disabled',
    requiredLicense: 'allowBackupRestore',
    featureFlag: BACKUP_RESTORE_CENTER_ENABLED_ENV,
    version: '43a.0',
    adapterAttached: false,
    executable: false,
  },
  {
    typeId: 'media-prefix',
    displayName: 'Media prefix snapshot',
    category: 'files',
    ownerModule: 'media',
    registrationKind: 'backupAdapter',
    status: 'disabled',
    requiredLicense: 'allowBackupRestore',
    featureFlag: BACKUP_RESTORE_CENTER_ENABLED_ENV,
    version: '43a.0',
    adapterAttached: false,
    executable: false,
  },
  {
    typeId: 'script-bridge',
    displayName: 'Legacy script bridge',
    category: 'compatibility',
    ownerModule: 'platform',
    registrationKind: 'backupAdapter',
    status: 'inactive',
    requiredLicense: 'allowBackupRestore',
    featureFlag: BACKUP_RESTORE_CENTER_ENABLED_ENV,
    version: '43a.0',
    adapterAttached: false,
    executable: false,
  },
] as const;

/** Explicit: static catalog is never runtime authority (Effective view arrives later). */
export const STATIC_BACKUP_RESTORE_CATALOG_IS_RUNTIME_AUTHORITY = false;
