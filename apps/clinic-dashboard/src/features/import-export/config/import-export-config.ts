import { hasPermission, type PermissionAction } from '@booking/permissions';

export const IMPORT_EXPORT_PERMISSION_RESOURCE = 'api.importExport';

export const IMPORT_EXPORT_BASE_PATH = '/settings/import-export';

export function canViewImportExport(roles: string[]) {
  return hasPermission(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'view');
}

export function canCreateImport(roles: string[]) {
  return hasPermission(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'create');
}

export function canExportData(roles: string[]) {
  return hasPermission(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'export');
}

export function canManageImportExport(roles: string[]) {
  return hasPermission(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, 'manage');
}

export function hasImportExportAction(roles: string[], action: PermissionAction) {
  return hasPermission(roles, IMPORT_EXPORT_PERMISSION_RESOURCE, action);
}

export const ACTIVE_JOB_STATUSES = ['queued', 'running', 'retrying', 'draft'] as const;
export const COMPLETED_JOB_STATUSES = ['completed', 'completed_with_warnings'] as const;
export const FAILED_JOB_STATUSES = ['failed', 'dead_letter', 'expired', 'cancelled'] as const;

export function isLiveJobStatus(status: string) {
  return status === 'queued' || status === 'running' || status === 'retrying' || status === 'draft';
}

export function formatBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
