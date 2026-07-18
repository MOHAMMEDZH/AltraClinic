import type { PermissionAction } from './permission-matrix.validation';

interface PermissionMatrixJson {
  resources: Array<{
    id: string;
    permissions: Record<PermissionAction, string[]>;
  }>;
}

let cachedMatrix: PermissionMatrixJson | null | undefined;

function loadMatrix(): PermissionMatrixJson | null {
  if (cachedMatrix !== undefined) return cachedMatrix;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cachedMatrix = require('../../../config/permission-matrix.json') as PermissionMatrixJson;
    return cachedMatrix;
  } catch {
    cachedMatrix = null;
    return null;
  }
}

export function rolesCanAccessResource(
  roles: string[],
  resourceId: string,
  action: PermissionAction = 'view',
): boolean {
  const normalized = roles.map((role) => String(role ?? '').trim()).filter(Boolean);
  if (normalized.includes('super_admin')) return true;

  const matrix = loadMatrix();
  if (!matrix) return false;

  const resource = matrix.resources.find((entry) => entry.id === resourceId);
  if (!resource) return false;

  const allowed = resource.permissions[action] ?? [];
  return normalized.some((role) => allowed.includes(role));
}

export function rolesCanAccessResourceAnyAction(roles: string[], resourceId: string): boolean {
  const actions: PermissionAction[] = ['view', 'create', 'update', 'delete', 'approve', 'export', 'manage'];
  return actions.some((action) => rolesCanAccessResource(roles, resourceId, action));
}
