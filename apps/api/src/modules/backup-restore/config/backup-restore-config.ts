import {
  BACKUP_CENTER_ENABLED_ENV,
  BACKUP_RESTORE_CENTER_ENABLED_ENV,
  BACKUP_RESTORE_ENABLED_ENV,
  BACKUP_RESTORE_EXTENSION_KIND,
  BACKUP_RESTORE_METRICS_NAMESPACE,
  BACKUP_RESTORE_QUEUE_NAME,
  BACKUP_RESTORE_TRACE_NAMESPACE,
  BACKUP_SCHEDULER_ENABLED_ENV,
  BACKUP_VERIFY_ENABLED_ENV,
} from '../backup-restore.constants';
import type {
  CompressionAlgorithm,
  EncryptionClass,
} from '../domain/value-objects';

/**
 * Phase 43a configuration defaults.
 * No runtime behavior beyond flag/name registration.
 */
export interface BackupRestoreFeatureFlags {
  centerEnabled: boolean;
  backupCenterEnabled: boolean;
  restoreEnabled: boolean;
  verifyEnabled: boolean;
  schedulerEnabled: boolean;
}

export interface BackupRestoreFoundationConfig {
  featureFlagEnv: string;
  featureEnabled: boolean;
  flags: BackupRestoreFeatureFlags;
  queueName: string;
  extensionKind: typeof BACKUP_RESTORE_EXTENSION_KIND;
  metricsNamespace: string;
  traceNamespace: string;
  defaults: BackupRestoreDefaults;
}

export interface BackupRestoreDefaults {
  retentionDays: number;
  compression: CompressionAlgorithm;
  encryptionClass: EncryptionClass;
  maxConcurrentJobs: number;
  chunkSizeBytes: number;
  verifyAfterBackup: boolean;
  dualControlRestore: boolean;
  storageProvider: 'unconfigured';
}

function envFlagTrue(
  env: NodeJS.ProcessEnv,
  key: string,
): boolean {
  const raw = (env[key] ?? 'false').trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function isBackupRestoreCenterEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  return envFlagTrue(env, BACKUP_RESTORE_CENTER_ENABLED_ENV);
}

export function loadBackupRestoreFeatureFlags(
  env: NodeJS.ProcessEnv = process.env,
): BackupRestoreFeatureFlags {
  return {
    centerEnabled: isBackupRestoreCenterEnabled(env),
    backupCenterEnabled: envFlagTrue(env, BACKUP_CENTER_ENABLED_ENV),
    restoreEnabled: envFlagTrue(env, BACKUP_RESTORE_ENABLED_ENV),
    verifyEnabled: envFlagTrue(env, BACKUP_VERIFY_ENABLED_ENV),
    schedulerEnabled: envFlagTrue(env, BACKUP_SCHEDULER_ENABLED_ENV),
  };
}

export function loadBackupRestoreDefaults(
  env: NodeJS.ProcessEnv = process.env,
): BackupRestoreDefaults {
  const retentionRaw = Number(env.BACKUP_RESTORE_DEFAULT_RETENTION_DAYS ?? '30');
  return {
    retentionDays: Number.isFinite(retentionRaw) && retentionRaw > 0 ? retentionRaw : 30,
    compression: 'gzip',
    encryptionClass: 'envelope',
    maxConcurrentJobs: 1,
    chunkSizeBytes: 8 * 1024 * 1024,
    verifyAfterBackup: true,
    dualControlRestore: true,
    storageProvider: 'unconfigured',
  };
}

export function loadBackupRestoreFoundationConfig(
  env: NodeJS.ProcessEnv = process.env,
): BackupRestoreFoundationConfig {
  const flags = loadBackupRestoreFeatureFlags(env);
  return {
    featureFlagEnv: BACKUP_RESTORE_CENTER_ENABLED_ENV,
    featureEnabled: flags.centerEnabled,
    flags,
    queueName: BACKUP_RESTORE_QUEUE_NAME,
    extensionKind: BACKUP_RESTORE_EXTENSION_KIND,
    metricsNamespace: BACKUP_RESTORE_METRICS_NAMESPACE,
    traceNamespace: BACKUP_RESTORE_TRACE_NAMESPACE,
    defaults: loadBackupRestoreDefaults(env),
  };
}
