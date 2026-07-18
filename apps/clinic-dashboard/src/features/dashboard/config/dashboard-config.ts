import type { CanonicalDashboardWidgetId } from '@booking/module-registry/dashboard';

export type DashboardWidgetId = CanonicalDashboardWidgetId;

export type DashboardWidgetCategory =
  | 'operations'
  | 'finance'
  | 'clinical'
  | 'inventory'
  | 'platform';

/** Widget grouping for dashboard category filter */
export const WIDGET_CATEGORY: Record<DashboardWidgetId, DashboardWidgetCategory> = {
  'kpi-overview': 'operations',
  'quick-actions': 'operations',
  'today-appointments': 'operations',
  'queue-status': 'operations',
  'patient-stats': 'clinical',
  'revenue-summary': 'finance',
  'outstanding-payments': 'finance',
  'revenue-chart': 'finance',
  'appointment-trends': 'operations',
  'patient-growth': 'clinical',
  'branch-performance': 'operations',
  'doctor-performance': 'clinical',
  'treatment-stats': 'clinical',
  'inventory-alerts': 'inventory',
  'low-stock': 'inventory',
  'subscription-status': 'platform',
  notifications: 'platform',
  'recent-activities': 'operations',
  'tasks-reminders': 'clinical',
  'business-health': 'finance',
};

export type DashboardProfileId =
  | 'owner'
  | 'general_manager'
  | 'branch_manager'
  | 'receptionist'
  | 'doctor'
  | 'dentist'
  | 'nurse'
  | 'accountant'
  | 'inventory_manager'
  | 'default';

export interface WidgetDefinition {
  id: DashboardWidgetId;
  /** Permission resource required to show widget */
  resourceId?: string;
  span?: 'full' | 'half' | 'third' | 'two-thirds';
}

const WIDGETS: Record<DashboardWidgetId, WidgetDefinition> = {
  'kpi-overview': { id: 'kpi-overview', span: 'full' },
  'quick-actions': { id: 'quick-actions', span: 'full' },
  'today-appointments': { id: 'today-appointments', resourceId: 'api.scheduling', span: 'half' },
  'queue-status': { id: 'queue-status', resourceId: 'api.queue', span: 'half' },
  'patient-stats': { id: 'patient-stats', resourceId: 'api.patients', span: 'half' },
  'revenue-summary': { id: 'revenue-summary', resourceId: 'api.billing', span: 'half' },
  'outstanding-payments': { id: 'outstanding-payments', resourceId: 'api.billing', span: 'half' },
  'revenue-chart': { id: 'revenue-chart', resourceId: 'api.analytics', span: 'two-thirds' },
  'appointment-trends': { id: 'appointment-trends', resourceId: 'api.analytics', span: 'two-thirds' },
  'patient-growth': { id: 'patient-growth', resourceId: 'api.analytics', span: 'two-thirds' },
  'branch-performance': { id: 'branch-performance', resourceId: 'api.analytics', span: 'half' },
  'doctor-performance': { id: 'doctor-performance', resourceId: 'api.emr', span: 'half' },
  'treatment-stats': { id: 'treatment-stats', resourceId: 'api.emr', span: 'half' },
  'inventory-alerts': { id: 'inventory-alerts', resourceId: 'api.inventory', span: 'half' },
  'low-stock': { id: 'low-stock', resourceId: 'api.inventory', span: 'half' },
  'subscription-status': { id: 'subscription-status', resourceId: 'api.subscription', span: 'half' },
  notifications: { id: 'notifications', resourceId: 'api.notifications', span: 'half' },
  'recent-activities': { id: 'recent-activities', resourceId: 'api.audit', span: 'half' },
  'tasks-reminders': { id: 'tasks-reminders', resourceId: 'api.workflow', span: 'half' },
  'business-health': { id: 'business-health', resourceId: 'api.analytics', span: 'full' },
};

/** Role priority — highest matching role wins */
const ROLE_PRIORITY: string[] = [
  'owner',
  'general_manager',
  'branch_manager',
  'accountant',
  'inventory_manager',
  'doctor',
  'dentist',
  'specialist',
  'nurse',
  'receptionist',
  'assistant',
];

const PROFILE_WIDGETS: Record<DashboardProfileId, DashboardWidgetId[]> = {
  owner: [
    'kpi-overview',
    'quick-actions',
    'business-health',
    'revenue-summary',
    'outstanding-payments',
    'revenue-chart',
    'appointment-trends',
    'patient-growth',
    'branch-performance',
    'doctor-performance',
    'subscription-status',
    'notifications',
    'recent-activities',
    'inventory-alerts',
  ],
  general_manager: [
    'kpi-overview',
    'quick-actions',
    'business-health',
    'revenue-summary',
    'queue-status',
    'appointment-trends',
    'patient-growth',
    'branch-performance',
    'inventory-alerts',
    'recent-activities',
  ],
  branch_manager: [
    'kpi-overview',
    'quick-actions',
    'queue-status',
    'today-appointments',
    'revenue-summary',
    'appointment-trends',
    'low-stock',
    'recent-activities',
  ],
  receptionist: [
    'kpi-overview',
    'quick-actions',
    'queue-status',
    'today-appointments',
    'revenue-summary',
    'patient-stats',
  ],
  doctor: [
    'kpi-overview',
    'quick-actions',
    'today-appointments',
    'treatment-stats',
    'patient-stats',
    'patient-growth',
    'tasks-reminders',
  ],
  dentist: [
    'kpi-overview',
    'quick-actions',
    'today-appointments',
    'treatment-stats',
    'patient-stats',
    'patient-growth',
    'tasks-reminders',
  ],
  nurse: [
    'kpi-overview',
    'quick-actions',
    'queue-status',
    'today-appointments',
    'patient-stats',
  ],
  accountant: [
    'kpi-overview',
    'quick-actions',
    'revenue-summary',
    'outstanding-payments',
    'revenue-chart',
    'business-health',
    'recent-activities',
  ],
  inventory_manager: [
    'kpi-overview',
    'quick-actions',
    'inventory-alerts',
    'low-stock',
    'recent-activities',
  ],
  default: [
    'kpi-overview',
    'quick-actions',
    'today-appointments',
    'queue-status',
    'revenue-summary',
    'appointment-trends',
  ],
};

export function resolveDashboardProfile(roles: string[]): DashboardProfileId {
  for (const role of ROLE_PRIORITY) {
    if (roles.includes(role)) {
      if (role === 'specialist') return 'doctor';
      if (role === 'assistant') return 'receptionist';
      return role as DashboardProfileId;
    }
  }
  return 'default';
}

export function getWidgetsForRoles(
  roles: string[],
  hasPermission: (resourceId: string) => boolean,
): WidgetDefinition[] {
  const profile = resolveDashboardProfile(roles);
  const ids = PROFILE_WIDGETS[profile] ?? PROFILE_WIDGETS.default;
  return ids
    .map((id) => WIDGETS[id])
    .filter((widget) => !widget.resourceId || hasPermission(widget.resourceId));
}

export function getProfileLabelKey(profile: DashboardProfileId): string {
  return `dashboard.profiles.${profile}`;
}

export function filterWidgetsByCategory(
  widgetIds: DashboardWidgetId[],
  category: 'all' | DashboardWidgetCategory,
): DashboardWidgetId[] {
  if (category === 'all') return widgetIds;
  return widgetIds.filter((id) => WIDGET_CATEGORY[id] === category);
}

export type DashboardLayoutType = 'executive' | 'operational' | 'clinical';

export type QuickActionId =
  | 'appointments'
  | 'queue'
  | 'patients'
  | 'billing'
  | 'inventory'
  | 'encounters';

const PROFILE_QUICK_ACTIONS: Record<DashboardProfileId, QuickActionId[]> = {
  owner: ['appointments', 'queue', 'patients', 'billing', 'inventory'],
  general_manager: ['appointments', 'queue', 'patients', 'billing', 'inventory'],
  branch_manager: ['appointments', 'queue', 'patients', 'billing', 'inventory'],
  receptionist: ['appointments', 'queue', 'patients', 'billing'],
  doctor: ['appointments', 'patients', 'encounters'],
  dentist: ['appointments', 'patients', 'encounters'],
  nurse: ['appointments', 'queue', 'patients'],
  accountant: ['billing', 'patients'],
  inventory_manager: ['inventory', 'patients'],
  default: ['appointments', 'queue', 'patients', 'billing', 'inventory'],
};

export function getQuickActionsForProfile(profile: DashboardProfileId): QuickActionId[] {
  return PROFILE_QUICK_ACTIONS[profile] ?? PROFILE_QUICK_ACTIONS.default;
}

export function getProfileLayoutType(profile: DashboardProfileId): DashboardLayoutType {
  switch (profile) {
    case 'owner':
    case 'general_manager':
    case 'accountant':
      return 'executive';
    case 'doctor':
    case 'dentist':
      return 'clinical';
    default:
      return 'operational';
  }
}

export function getProfileSubtitleKey(profile: DashboardProfileId): string {
  return `dashboard.profileSubtitle.${profile}`;
}

/** Exported for dynamic-dashboard catalog parity (Phase 31). */
export const DASHBOARD_WIDGET_DEFINITIONS: Record<DashboardWidgetId, WidgetDefinition> = WIDGETS;

/** Exported for dynamic-dashboard catalog parity (Phase 31). */
export const DASHBOARD_PROFILE_WIDGETS: Record<DashboardProfileId, DashboardWidgetId[]> =
  PROFILE_WIDGETS;

/** Exported for dynamic-dashboard profile resolution parity (Phase 31). */
export const DASHBOARD_ROLE_PRIORITY: readonly string[] = ROLE_PRIORITY;
