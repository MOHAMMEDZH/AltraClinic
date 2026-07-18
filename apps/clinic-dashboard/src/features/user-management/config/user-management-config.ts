import { hasPermission } from '@booking/permissions';

const STAFF_ROLE_KEYS = [
  'owner',
  'general_manager',
  'branch_manager',
  'doctor',
  'dentist',
  'specialist',
  'nurse',
  'assistant',
  'receptionist',
  'accountant',
  'inventory_manager',
  'lab_technician',
  'radiologist',
  'cashier',
  'hr',
  'marketing',
] as const;

export type IdentityPermAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export function buildIdentityPermCheck(roles: string[]) {
  return (action: IdentityPermAction) => hasPermission(roles, 'api.identity', action);
}

export function canViewUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('view');
}

export function canCreateUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('create');
}

export function canUpdateUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('update');
}

export function canManageUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('manage');
}

export function canExportUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('export');
}

export function canDeleteUsers(perm: ReturnType<typeof buildIdentityPermCheck>) {
  return perm('delete');
}

export function assignableRoles(): string[] {
  return [...STAFF_ROLE_KEYS];
}

export const USER_STATUS_FILTERS = ['all', 'active', 'inactive', 'locked'] as const;
export type UserStatusFilter = (typeof USER_STATUS_FILTERS)[number];

export const EMPLOYMENT_STATUS_FILTERS = [
  'active',
  'suspended',
  'on_leave',
  'archived',
  'terminated',
] as const;
export type EmploymentStatusFilter = (typeof EMPLOYMENT_STATUS_FILTERS)[number];

export const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;
