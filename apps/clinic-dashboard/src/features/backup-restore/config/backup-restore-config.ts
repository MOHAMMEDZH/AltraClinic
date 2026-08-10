import { hasPermission, type PermissionAction } from '@booking/permissions';

export const BACKUP_RESTORE_PERMISSION_RESOURCE = 'api.backupRestore';

export const BACKUP_RESTORE_BASE_PATH = '/settings/backup-restore';

export function canViewBackupRestore(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'view');
}

export function canCreateBackup(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'create');
}

export function canVerify(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'update');
}

export function canRestore(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'manage');
}

export function canApproveRestore(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'approve');
}

export function canManage(roles: string[]) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, 'manage');
}

export function hasBackupRestoreAction(roles: string[], action: PermissionAction) {
  return hasPermission(roles, BACKUP_RESTORE_PERMISSION_RESOURCE, action);
}

export const ACTIVE_JOB_STATUSES = [
  'created',
  'queued',
  'validating',
  'waiting',
  'running',
  'paused',
  'cancelling',
  'retrying',
] as const;

export const COMPLETED_JOB_STATUSES = ['completed', 'verified'] as const;

export const FAILED_JOB_STATUSES = ['failed', 'cancelled', 'expired', 'dead_letter'] as const;

export function isLiveJobStatus(status: string) {
  return (ACTIVE_JOB_STATUSES as readonly string[]).includes(status);
}

export function isCompletedJobStatus(status: string) {
  return (COMPLETED_JOB_STATUSES as readonly string[]).includes(status);
}

export function isFailedJobStatus(status: string) {
  return (FAILED_JOB_STATUSES as readonly string[]).includes(status);
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  if (size < 1024 * 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
  return `${(size / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
