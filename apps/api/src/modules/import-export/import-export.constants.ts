/**
 * Phase 42a — Import/Export Center foundation constants.
 * Infrastructure only. No business adapters or job execution.
 */

/** Env feature flag. Default OFF (dormant platform). */
export const IMPORT_EXPORT_CENTER_ENABLED_ENV = 'IMPORT_EXPORT_CENTER_ENABLED';

/** BullMQ queue name — must never collide with `notification-delivery`. */
export const IMPORT_EXPORT_QUEUE_NAME = 'import-export';

/**
 * Extension kind string.
 * Phase 42b decision: remains locally registered (no Module Registry redesign).
 */
export const IMPORT_EXPORT_EXTENSION_KIND = 'importExport' as const;

/** Permission matrix resource id. */
export const IMPORT_EXPORT_PERMISSION_RESOURCE = 'api.importExport';

/**
 * Logical permission names from the 42a brief → matrix actions.
 * Matrix actions remain the platform vocabulary (view/create/manage/export).
 */
export const IMPORT_EXPORT_PERMISSION_ACTIONS = {
  /** Brief: api.importExport.read */
  read: 'view',
  /** Brief: api.importExport.create */
  create: 'create',
  /** Brief: api.importExport.manage */
  manage: 'manage',
  /** Brief: api.importExport.download → matrix `export` */
  download: 'export',
} as const;

export const IMPORT_EXPORT_LOG_KIND = 'import_export';
export const IMPORT_EXPORT_METRICS_NAMESPACE = 'import_export';
export const IMPORT_EXPORT_TRACE_NAMESPACE = 'import_export';

/** Activity event names — emitted by Phase 42c Job Engine (orchestration only). */
export const IMPORT_EXPORT_ACTIVITY_EVENTS = [
  'job_created',
  'job_queued',
  'job_started',
  'job_validating',
  'job_validated',
  'job_exporting',
  'job_importing',
  'job_completed',
  'job_completed_with_warnings',
  'job_failed',
  'job_retry',
  'job_cancelled',
  'job_dead_letter',
  'job_expired',
  'artifact_ready',
  'artifact_download_requested',
] as const;

/** Audit action names — Job Engine + Import Runtime. */
export const IMPORT_EXPORT_AUDIT_ACTIONS = [
  'importExport.job.created',
  'importExport.job.cancelled',
  'importExport.job.state_changed',
  'importExport.job.dead_lettered',
  'importExport.job.requeued',
  'importExport.import.committed',
  'importExport.import.file_uploaded',
  'importExport.import.dry_run_completed',
  'importExport.import.completed',
  'importExport.import.malware_rejected',
  'importExport.import.notification_failed',
  'importExport.export.completed',
  'importExport.export.failed',
  'importExport.export.notification_failed',
  'importExport.artifact.download_token_issued',
  'importExport.artifact.downloaded',
] as const;
