import matrix from '../permission-matrix.json';

export type PermissionAction =
  | 'view'
  | 'create'
  | 'update'
  | 'delete'
  | 'approve'
  | 'export'
  | 'manage';

export interface PermissionMatrixResource {
  id: string;
  permissions: Partial<Record<PermissionAction, string[]>>;
}

export interface PermissionMatrix {
  resources: PermissionMatrixResource[];
}

export interface NavItemDefinition {
  id: string;
  path: string;
  labelKey: string;
  icon: string;
  /** Permission matrix resource id; omit for always-visible items */
  resourceId?: string;
  action?: PermissionAction;
  /** When set, item is visible only if the user has one of these roles (in addition to permission). */
  roles?: string[];
}

const cachedMatrix = matrix as PermissionMatrix & {
  roles?: Array<{ key: string; inherits?: string[] }>;
};

function expandRoles(roles: string[]): string[] {
  const result = new Set(roles);
  const roleDefs = cachedMatrix.roles ?? [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const role of [...result]) {
      const def = roleDefs.find((r) => r.key === role);
      for (const inherited of def?.inherits ?? []) {
        if (!result.has(inherited)) {
          result.add(inherited);
          changed = true;
        }
      }
    }
  }
  return [...result];
}

export function getPermissionMatrix(): PermissionMatrix {
  return cachedMatrix;
}

const PROTECTED_PERMISSIONS: Array<{ resourceId: string; action: PermissionAction }> = [
  { resourceId: 'api.clinical-forms', action: 'approve' },
];

export function isProtectedPermission(
  resourceId: string,
  action: PermissionAction,
): boolean {
  return PROTECTED_PERMISSIONS.some((ex) => ex.resourceId === resourceId && ex.action === action);
}

export function hasPermission(
  roles: string[],
  resourceId: string,
  action: PermissionAction = 'view',
): boolean {
  const effective = expandRoles(roles);
  if (effective.includes('super_admin') && !isProtectedPermission(resourceId, action)) return true;

  const resource = cachedMatrix.resources.find((r) => r.id === resourceId);
  if (!resource) return false;

  const allowed = resource.permissions[action] ?? [];
  return effective.some((role) => allowed.includes(role));
}

/** Merge custom role permission grants with static matrix check. */
export function hasPermissionWithCustomGrants(
  roles: string[],
  customGrants: Array<Record<string, string[]>>,
  resourceId: string,
  action: PermissionAction = 'view',
): boolean {
  if (hasPermission(roles, resourceId, action)) return true;
  if (isProtectedPermission(resourceId, action)) return false;
  return customGrants.some((grant) => (grant[resourceId] ?? []).includes(action));
}

export function filterNavItems(
  items: NavItemDefinition[],
  roles: string[],
): NavItemDefinition[] {
  return items.filter((item) => {
    if (item.roles?.length && !item.roles.some((role) => roles.includes(role))) return false;
    if (!item.resourceId) return true;
    return hasPermission(roles, item.resourceId, item.action ?? 'view');
  });
}

/** Primary clinic sidebar navigation — aligned with DESIGN_SYSTEM_BLUEPRINT §11 */
export const CLINIC_NAV_ITEMS: NavItemDefinition[] = [
  { id: 'dashboard', path: '/', labelKey: 'nav.dashboard', icon: 'LayoutDashboard' },
  { id: 'appointments', path: '/appointments', labelKey: 'nav.appointments', icon: 'Calendar', resourceId: 'api.scheduling' },
  { id: 'my-appointments', path: '/my-appointments', labelKey: 'nav.myAppointments', icon: 'CalendarCheck', resourceId: 'api.patient_portal', roles: ['patient'] },
  { id: 'queue', path: '/queue', labelKey: 'nav.queue', icon: 'Users', resourceId: 'api.queue' },
  { id: 'patients', path: '/patients', labelKey: 'nav.patients', icon: 'UserRound', resourceId: 'api.patients' },
  { id: 'encounters', path: '/encounters', labelKey: 'nav.encounters', icon: 'Stethoscope', resourceId: 'api.emr' },
  { id: 'dental', path: '/dental', labelKey: 'nav.dental', icon: 'Smile', resourceId: 'api.dental' },
  { id: 'beauty', path: '/beauty', labelKey: 'nav.beauty', icon: 'Sparkles', resourceId: 'api.beauty' },
  { id: 'billing', path: '/billing', labelKey: 'nav.billing', icon: 'Receipt', resourceId: 'api.billing' },
  { id: 'subscription', path: '/settings/subscription', labelKey: 'nav.subscription', icon: 'CreditCard', resourceId: 'api.subscription' },
  { id: 'inventory', path: '/inventory', labelKey: 'nav.inventory', icon: 'Package', resourceId: 'api.inventory' },
  { id: 'reports', path: '/reports', labelKey: 'nav.reports', icon: 'FileBarChart', resourceId: 'api.reporting' },
  { id: 'analytics', path: '/analytics', labelKey: 'nav.analytics', icon: 'BarChart3', resourceId: 'api.analytics' },
  { id: 'workflows', path: '/workflows', labelKey: 'nav.workflows', icon: 'GitBranch', resourceId: 'api.workflow' },
  { id: 'ai', path: '/ai', labelKey: 'nav.aiAssistant', icon: 'Bot', resourceId: 'api.ai' },
  { id: 'settings', path: '/settings', labelKey: 'nav.settings', icon: 'Settings', resourceId: 'api.identity' },
];
