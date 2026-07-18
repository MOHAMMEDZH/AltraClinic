/** UI-only observability — never duplicates backend Activity. */
export type ImportExportUiEvent =
  | 'page_opened'
  | 'job_viewed'
  | 'artifact_downloaded'
  | 'wizard_started'
  | 'wizard_completed'
  | 'catalog_viewed'
  | 'health_viewed'
  | 'cancel_requested'
  | 'retry_requested';

export function logImportExportUiEvent(
  event: ImportExportUiEvent,
  details: Record<string, string | number | boolean | null | undefined> = {},
) {
  // Structured console log for ops telemetry hooks
  // eslint-disable-next-line no-console
  console.info(
    JSON.stringify({
      kind: 'import_export_ui',
      event,
      ts: new Date().toISOString(),
      ...details,
    }),
  );
}
