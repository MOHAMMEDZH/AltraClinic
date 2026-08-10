/**
 * Phase 43a — Licensing capability registry only.
 * Consumes TenantPolicyService.allowBackupRestore; no SKU engine redesign.
 */
import {
  BACKUP_RESTORE_LICENSE_CAPABILITIES,
  BACKUP_RESTORE_TENANT_LICENSE_GATE,
} from '../backup-restore.constants';

export type BackupRestoreLicenseCapability =
  (typeof BACKUP_RESTORE_LICENSE_CAPABILITIES)[number];

export class BackupRestoreLicensingContracts {
  readonly tenantGate = BACKUP_RESTORE_TENANT_LICENSE_GATE;
  readonly capabilities: readonly BackupRestoreLicenseCapability[] =
    BACKUP_RESTORE_LICENSE_CAPABILITIES;

  listCapabilities(): readonly BackupRestoreLicenseCapability[] {
    return this.capabilities;
  }

  getTenantLicenseGate(): typeof BACKUP_RESTORE_TENANT_LICENSE_GATE {
    return this.tenantGate;
  }
}
