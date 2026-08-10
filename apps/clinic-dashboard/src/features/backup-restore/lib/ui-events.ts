/** UI-only observability — never duplicates backend Activity. */
export type BackupRestoreUiEvent =
  | 'page_opened'
  | 'job_viewed'
  | 'catalog_viewed'
  | 'health_viewed'
  | 'cancel_requested'
  | 'backup_requested'
  | 'restore_requested'
  | 'snapshot_viewed';

export function logBackupRestoreUiEvent(
  event: BackupRestoreUiEvent,
  details: Record<string, string | number | boolean | null | undefined> = {},
) {
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      kind: 'backup_restore_ui',
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  );
}
