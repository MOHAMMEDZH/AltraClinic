import { hasPermission, type PermissionAction } from '@booking/permissions';

export const API_INTEGRATIONS_BASE_PATH = '/settings/api-integrations';
export const API_INTEGRATIONS_RESOURCE = 'api.integrations';

export function canViewApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'view');
}

export function canCreateApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'create');
}

export function canUpdateApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'update');
}

export function canDeleteApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'delete');
}

export function canManageApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'manage');
}

export function canApproveApiIntegrations(roles: string[]): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, 'approve');
}

export function hasApiIntegrationsAction(
  roles: string[],
  action: PermissionAction,
): boolean {
  return hasPermission(roles, API_INTEGRATIONS_RESOURCE, action);
}

export const CREDENTIAL_STATUSES = [
  'active',
  'expiring',
  'rotated',
  'revoked',
  'expired',
] as const;

export function formatIso(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return value;
  }
}
