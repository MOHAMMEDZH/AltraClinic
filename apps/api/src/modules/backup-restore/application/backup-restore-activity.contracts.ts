/**
 * Phase 43a — Activity event name registry only.
 * Does NOT emit Activity at runtime.
 */
import { BACKUP_RESTORE_ACTIVITY_EVENTS } from '../backup-restore.constants';

export type BackupRestoreActivityEventName =
  (typeof BACKUP_RESTORE_ACTIVITY_EVENTS)[number];

export class BackupRestoreActivityContracts {
  readonly eventNames: readonly BackupRestoreActivityEventName[] =
    BACKUP_RESTORE_ACTIVITY_EVENTS;

  listEventNames(): readonly BackupRestoreActivityEventName[] {
    return this.eventNames;
  }
}
