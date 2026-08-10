export const LIFECYCLE_PERMISSIONS = {
  view: 'tenant.view',
  activate: 'tenant.activate',
  suspend: 'tenant.suspend',
  resume: 'tenant.resume',
  archiveRequest: 'tenant.archive-request',
  deleteRequest: 'tenant.delete-request',
  approve: 'tenant.request.approve',
} as const;

export type LifecyclePermission =
  (typeof LIFECYCLE_PERMISSIONS)[keyof typeof LIFECYCLE_PERMISSIONS];

export const LIFECYCLE_OPERATIONS = {
  ACTIVATE: 'TENANT_LIFECYCLE_ACTIVATE',
  SUSPEND: 'TENANT_LIFECYCLE_SUSPEND',
  REACTIVATE: 'TENANT_LIFECYCLE_REACTIVATE',
  ARCHIVE_REQUEST: 'TENANT_ARCHIVAL_REQUEST_CREATE',
  DELETION_REQUEST: 'TENANT_DELETION_REQUEST_CREATE',
  APPROVE: 'TENANT_LIFECYCLE_REQUEST_APPROVE',
  REJECT: 'TENANT_LIFECYCLE_REQUEST_REJECT',
  CANCEL: 'TENANT_LIFECYCLE_REQUEST_CANCEL',
} as const;

export type LifecycleOperation =
  (typeof LIFECYCLE_OPERATIONS)[keyof typeof LIFECYCLE_OPERATIONS];

export const PREVIEW_TTL_MS = 5 * 60 * 1000;
export const REASON_MAX_LEN = 2000;
