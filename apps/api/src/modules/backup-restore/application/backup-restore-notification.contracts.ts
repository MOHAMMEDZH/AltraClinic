/**
 * Phase 43a — Notification intent kind registry only.
 * Does NOT produce or send notifications.
 */
import { BACKUP_RESTORE_NOTIFICATION_INTENTS } from '../backup-restore.constants';

export type BackupRestoreNotificationIntentKind =
  (typeof BACKUP_RESTORE_NOTIFICATION_INTENTS)[number];

export class BackupRestoreNotificationContracts {
  readonly intentKinds: readonly BackupRestoreNotificationIntentKind[] =
    BACKUP_RESTORE_NOTIFICATION_INTENTS;

  listIntentKinds(): readonly BackupRestoreNotificationIntentKind[] {
    return this.intentKinds;
  }
}
