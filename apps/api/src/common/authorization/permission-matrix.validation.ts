export type PermissionAction = 'view' | 'create' | 'update' | 'delete' | 'approve' | 'export' | 'manage';

export interface PermissionResource {
  id: string;
  kind: 'screen' | 'api' | 'report' | 'operation' | 'export';
  name: string;
  permissions: Record<PermissionAction, string[]>;
  operations: Array<{ method: string; path: string; action: PermissionAction; notes?: string }>;
}

export interface PermissionMatrix {
  version: string;
  roles: Array<{ key: string; name: string }>;
  actions: PermissionAction[];
  resources: PermissionResource[];
}

const REQUIRED_ACTIONS: PermissionAction[] = [
  'view',
  'create',
  'update',
  'delete',
  'approve',
  'export',
  'manage',
];

const REQUIRED_ROLES = [
  'super_admin',
  'owner',
  'general_manager',
  'doctor',
  'dentist',
  'specialist',
  'nurse',
  'assistant',
  'receptionist',
  'accountant',
  'inventory_manager',
  'patient',
];

export function validatePermissionMatrix(matrix: PermissionMatrix): string[] {
  const errors: string[] = [];

  const roleSet = new Set(matrix.roles.map((role) => role.key));
  for (const role of REQUIRED_ROLES) {
    if (!roleSet.has(role)) {
      errors.push(`Missing required role: ${role}`);
    }
  }

  for (const action of REQUIRED_ACTIONS) {
    if (!matrix.actions.includes(action)) {
      errors.push(`Missing required action in matrix.actions: ${action}`);
    }
  }

  for (const resource of matrix.resources) {
    for (const action of REQUIRED_ACTIONS) {
      if (!resource.permissions[action]) {
        errors.push(`Resource ${resource.id} missing permissions for action ${action}`);
        continue;
      }

      for (const roleKey of resource.permissions[action]) {
        if (!roleSet.has(roleKey)) {
          errors.push(
            `Resource ${resource.id} action ${action} references unknown role ${roleKey}`,
          );
        }
      }
    }

    for (const operation of resource.operations) {
      if (!REQUIRED_ACTIONS.includes(operation.action)) {
        errors.push(
          `Resource ${resource.id} operation ${operation.method} ${operation.path} has invalid action ${operation.action}`,
        );
      }
    }

    for (const action of REQUIRED_ACTIONS) {
      if (!resource.permissions[action].includes('super_admin')) {
        errors.push(
          `Resource ${resource.id} action ${action} must include super_admin`,
        );
      }
    }

    if (resource.id.startsWith('api.platform_admin')) {
      for (const action of ['create', 'update', 'delete', 'approve'] as PermissionAction[]) {
        const allowed = resource.permissions[action];
        if (allowed.some((role) => role !== 'super_admin')) {
          errors.push(
            `Resource ${resource.id} action ${action} must be super_admin-only`,
          );
        }
      }
    }

    if (!resource.id.startsWith('screen.patient_portal') && !resource.id.startsWith('api.patient_portal')) {
      if (resource.permissions.approve.includes('patient')) {
        errors.push(`Resource ${resource.id} cannot allow patient approve`);
      }
      if (resource.permissions.delete.includes('patient')) {
        errors.push(`Resource ${resource.id} cannot allow patient delete`);
      }
    }
  }

  return errors;
}
