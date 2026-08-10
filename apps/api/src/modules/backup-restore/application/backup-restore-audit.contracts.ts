/**
 * Phase 43a — Audit action name registry only.
 * Does NOT emit Audit entries at runtime.
 */
import { BACKUP_RESTORE_AUDIT_ACTIONS } from '../backup-restore.constants';

export type BackupRestoreAuditActionName =
  (typeof BACKUP_RESTORE_AUDIT_ACTIONS)[number];

export class BackupRestoreAuditContracts {
  readonly actionNames: readonly BackupRestoreAuditActionName[] =
    BACKUP_RESTORE_AUDIT_ACTIONS;

  listActionNames(): readonly BackupRestoreAuditActionName[] {
    return this.actionNames;
  }
}
