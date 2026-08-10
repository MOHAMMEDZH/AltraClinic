/**
 * Phase 43a — registration / catalog contracts (metadata only).
 */

export const BACKUP_RESTORE_LOCAL_EXTENSION_KIND = 'backupRestore' as const;

export type BackupRestoreRegistrationKind =
  | 'backupAdapter'
  | 'restoreAdapter'
  | 'verifyProvider'
  | 'storageProvider'
  | 'policyPack';

export type BackupRestoreRegistrationStatus =
  | 'disabled'
  | 'inactive'
  | 'active'
  | 'deprecated';

export type BackupRestoreRequiredLicense = 'allowBackupRestore';

export interface BackupRestoreRegistrationMetadata {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: BackupRestoreRegistrationKind;
  status: BackupRestoreRegistrationStatus;
  requiredLicense: BackupRestoreRequiredLicense;
  featureFlag: string | null;
  version: string;
  adapterAttached: boolean;
  executable: boolean;
}

export interface EffectiveBackupRestoreType {
  typeId: string;
  displayName: string;
  category: string;
  ownerModule: string;
  registrationKind: BackupRestoreRegistrationKind;
  status: BackupRestoreRegistrationStatus;
  version: string;
  featureFlag: string | null;
  adapterAttached: boolean;
  executable: boolean;
  visible: true;
}
