/**
 * Phase 43a — Backup & Restore Center foundation constants.
 * Infrastructure registration only. No backup/restore execution.
 */

/** Master env feature flag (Architecture SSOT). Default OFF. */
export const BACKUP_RESTORE_CENTER_ENABLED_ENV = 'BACKUP_RESTORE_CENTER_ENABLED';

/**
 * Sub-feature flags (all default OFF).
 * Do not enable runtime behavior in 43a; names are registered for later phases.
 */
export const BACKUP_CENTER_ENABLED_ENV = 'BACKUP_CENTER_ENABLED';
export const BACKUP_RESTORE_ENABLED_ENV = 'BACKUP_RESTORE_ENABLED';
export const BACKUP_VERIFY_ENABLED_ENV = 'BACKUP_VERIFY_ENABLED';
export const BACKUP_SCHEDULER_ENABLED_ENV = 'BACKUP_SCHEDULER_ENABLED';

/**
 * Reserved queue name for later phases.
 * Phase 43a/43b do NOT create BullMQ queues or workers.
 */
export const BACKUP_RESTORE_QUEUE_NAME = 'backup-restore';

/**
 * Extension kind string.
 * Locally registered (Module Registry package unchanged / no redesign).
 */
export const BACKUP_RESTORE_EXTENSION_KIND = 'backupRestore' as const;

/** Permission matrix resource id. */
export const BACKUP_RESTORE_PERMISSION_RESOURCE = 'api.backupRestore';

/**
 * Architecture logical permissions → matrix actions.
 * Matrix vocabulary remains view/create/update/delete/approve/export/manage.
 */
export const BACKUP_RESTORE_PERMISSION_ACTIONS = {
  /** backup_restore.policy.read / job.read / backup.view */
  view: 'view',
  /** backup_restore.job.run / backup.create */
  create: 'create',
  /** backup_restore.policy.write / backup.verify */
  update: 'update',
  /** backup.delete */
  delete: 'delete',
  /** backup_restore.restore.approve */
  approve: 'approve',
  /** backup_restore.artifact.download */
  download: 'export',
  /** backup_restore.restore.execute / backup.manage / backup.restore */
  manage: 'manage',
} as const;

export const BACKUP_RESTORE_LOG_KIND = 'backup_restore';
export const BACKUP_RESTORE_METRICS_NAMESPACE = 'backup_restore';
export const BACKUP_RESTORE_TRACE_NAMESPACE = 'backup_restore';

/** Licensing capability ids (consumed via tenant policy + future SKU map). */
export const BACKUP_RESTORE_LICENSE_CAPABILITIES = [
  'backupCenter',
  'scheduledBackup',
  'advancedRestore',
  'crossRegionBackup',
  'pointInTimeRestore',
] as const;

/** Tenant advanced policy gate (Architecture: allowBackupRestore). */
export const BACKUP_RESTORE_TENANT_LICENSE_GATE = 'allowBackupRestore' as const;

/** Activity event names — Job Engine lifecycle (43b) + domain names. */
export const BACKUP_RESTORE_ACTIVITY_EVENTS = [
  'job_created',
  'job_queued',
  'job_started',
  'job_paused',
  'job_resumed',
  'job_completed',
  'job_failed',
  'job_retry',
  'job_dead_letter',
  'job_cancelled',
  'job_expired',
  'backup_created',
  'backup_requested',
  'backup_started',
  'backup_completed',
  'backup_failed',
  'restore_requested',
  'restore_approved',
  'restore_started',
  'restore_completed',
  'restore_failed',
  'restore_validated',
  'recovery_point_selected',
  'policy_updated',
  'verification_started',
  'verification_completed',
  'verification_failed',
  'retention_applied',
  'retention_evaluated',
  'snapshot_expired',
  'cleanup_planned',
  'drill_started',
  'drill_completed',
] as const;

/** Audit action names — Job Engine + domain (emit via AuditLog). */
export const BACKUP_RESTORE_AUDIT_ACTIONS = [
  'backupRestore.job.created',
  'backupRestore.job.state_changed',
  'backupRestore.job.completed',
  'backupRestore.job.failed',
  'backupRestore.job.cancelled',
  'backupRestore.job.retry_scheduled',
  'backupRestore.job.dead_lettered',
  'backupRestore.job.verified',
  'backupRestore.backup.requested',
  'backupRestore.backup.started',
  'backupRestore.backup.created',
  'backupRestore.backup.completed',
  'backupRestore.backup.failed',
  'backupRestore.restore.requested',
  'backupRestore.restore.approved',
  'backupRestore.restore.executed',
  'backupRestore.restore.failed',
  'backupRestore.restore.recovery_point_selected',
  'backupRestore.policy.changed',
  'backupRestore.verification.requested',
  'backupRestore.verification.started',
  'backupRestore.verification.completed',
  'backupRestore.verification.failed',
  'backupRestore.retention.evaluated',
  'backupRestore.snapshot.expired_marked',
  'backupRestore.cleanup.planned',
  'backupRestore.artifact.downloaded',
  'backupRestore.drill.executed',
] as const;

/** Notification intent kinds — registered only (no delivery). */
export const BACKUP_RESTORE_NOTIFICATION_INTENTS = [
  'job_queued',
  'job_started',
  'job_completed',
  'job_failed',
  'job_cancelled',
  'verification_pending',
  'verification_requested',
  'verification_completed',
  'verification_failed',
  'backup_started',
  'backup_succeeded',
  'backup_failed',
  'snapshot_registered',
  'snapshot_expired',
  'cleanup_planned',
  'retention_policy_violation',
  'retention_evaluated',
  'restore_started',
  'restore_completed',
  'restore_failed',
  'recovery_point_selected',
  'restore_validation_failed',
  'drill_overdue',
] as const;

/** Health contributor ids. */
export const BACKUP_RESTORE_HEALTH_CONTRIBUTORS = [
  'job_engine',
  'repository',
  'configuration',
  'feature_flags',
  'backup_engine',
  'storage_provider',
  'compression',
  'encryption',
  'manifest_generator',
  'verification_engine',
  'retention_engine',
  'manifest_validator',
  'checksum_validator',
  'restore_engine',
  'recovery_point_resolver',
  'restore_validator',
  'restore_target_resolver',
  'backup_storage',
  'restore_storage',
  'verification',
  'scheduler',
  'queue',
] as const;

/** Metric name registry — hooks; no external backends. */
export const BACKUP_RESTORE_METRIC_NAMES = [
  'backup_restore.jobs.enqueued',
  'backup_restore.jobs.succeeded',
  'backup_restore.jobs.failed',
  'backup_restore.jobs.transitions',
  'backup_restore.jobs.retries',
  'backup_restore.backup.duration_ms',
  'backup_restore.backup.snapshot_bytes',
  'backup_restore.backup.compression_in',
  'backup_restore.backup.compression_out',
  'backup_restore.backup.failures',
  'backup_restore.verify.duration_ms',
  'backup_restore.verify.success',
  'backup_restore.verify.failed',
  'backup_restore.retention.evaluations',
  'backup_restore.retention.expired',
  'backup_restore.cleanup.plans',
  'backup_restore.restore.duration_ms',
  'backup_restore.restore.throughput_bytes',
  'backup_restore.restore.failures',
  'backup_restore.restore.validation_failures',
  'backup_restore.restore.recovery_point_selections',
  'backup_restore.artifact.bytes',
  'backup_restore.drill.completed',
] as const;
