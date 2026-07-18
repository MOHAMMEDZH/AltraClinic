import type { LicensedModuleId } from '../types';

/**
 * Canonical dashboard widget vocabulary — single source of truth for Phase 31.
 * Registry manifests, static catalog, widget registry, and tests must align to this list.
 */
export const CANONICAL_DASHBOARD_WIDGET_IDS = [
  'kpi-overview',
  'quick-actions',
  'today-appointments',
  'queue-status',
  'patient-stats',
  'revenue-summary',
  'outstanding-payments',
  'revenue-chart',
  'appointment-trends',
  'patient-growth',
  'branch-performance',
  'doctor-performance',
  'treatment-stats',
  'inventory-alerts',
  'low-stock',
  'subscription-status',
  'notifications',
  'recent-activities',
  'tasks-reminders',
  'business-health',
] as const;

export type CanonicalDashboardWidgetId = (typeof CANONICAL_DASHBOARD_WIDGET_IDS)[number];

export type CanonicalDashboardCategory =
  | 'operations'
  | 'finance'
  | 'clinical'
  | 'inventory'
  | 'platform';

export interface CanonicalDashboardWidget {
  id: CanonicalDashboardWidgetId;
  /** Licensed module that owns the dashboard contribution */
  moduleId: LicensedModuleId;
  componentKey: string;
  labelKey: string;
  resourceId?: string;
  sortOrder: number;
  category: CanonicalDashboardCategory;
  span?: 'full' | 'half' | 'third' | 'two-thirds';
}

/** Maps permission resources to licensed modules for catalog gating parity. */
export const CANONICAL_RESOURCE_TO_MODULE: Record<string, LicensedModuleId | 'core'> = {
  'api.scheduling': 'scheduling',
  'api.queue': 'queue',
  'api.patients': 'patients',
  'api.billing': 'billing',
  'api.analytics': 'analytics',
  'api.emr': 'emr',
  'api.inventory': 'inventory',
  'api.subscription': 'settings',
  'api.notifications': 'notifications',
  'api.audit': 'settings',
  'api.workflow': 'workflow',
};

export const CANONICAL_DASHBOARD_WIDGETS: readonly CanonicalDashboardWidget[] = [
  {
    id: 'kpi-overview',
    moduleId: 'dashboard',
    componentKey: 'widget.dashboard.kpiOverview',
    labelKey: 'dashboard.widgets.kpiOverview',
    sortOrder: 0,
    category: 'operations',
    span: 'full',
  },
  {
    id: 'quick-actions',
    moduleId: 'dashboard',
    componentKey: 'widget.dashboard.quickActions',
    labelKey: 'dashboard.widgets.quickActions',
    sortOrder: 10,
    category: 'operations',
    span: 'full',
  },
  {
    id: 'today-appointments',
    moduleId: 'scheduling',
    componentKey: 'widget.dashboard.todayAppointments',
    labelKey: 'dashboard.widgets.todayAppointments',
    resourceId: 'api.scheduling',
    sortOrder: 20,
    category: 'operations',
    span: 'half',
  },
  {
    id: 'queue-status',
    moduleId: 'queue',
    componentKey: 'widget.dashboard.queueStatus',
    labelKey: 'dashboard.widgets.queueStatus',
    resourceId: 'api.queue',
    sortOrder: 30,
    category: 'operations',
    span: 'half',
  },
  {
    id: 'patient-stats',
    moduleId: 'patients',
    componentKey: 'widget.dashboard.patientStats',
    labelKey: 'dashboard.widgets.patientStats',
    resourceId: 'api.patients',
    sortOrder: 40,
    category: 'clinical',
    span: 'half',
  },
  {
    id: 'revenue-summary',
    moduleId: 'billing',
    componentKey: 'widget.dashboard.revenueSummary',
    labelKey: 'dashboard.widgets.revenueSummary',
    resourceId: 'api.billing',
    sortOrder: 50,
    category: 'finance',
    span: 'half',
  },
  {
    id: 'outstanding-payments',
    moduleId: 'billing',
    componentKey: 'widget.dashboard.outstandingPayments',
    labelKey: 'dashboard.widgets.outstandingPayments',
    resourceId: 'api.billing',
    sortOrder: 60,
    category: 'finance',
    span: 'half',
  },
  {
    id: 'revenue-chart',
    moduleId: 'analytics',
    componentKey: 'widget.dashboard.revenueChart',
    labelKey: 'dashboard.widgets.revenueChart',
    resourceId: 'api.analytics',
    sortOrder: 70,
    category: 'finance',
    span: 'two-thirds',
  },
  {
    id: 'appointment-trends',
    moduleId: 'analytics',
    componentKey: 'widget.dashboard.appointmentTrends',
    labelKey: 'dashboard.widgets.appointmentTrends',
    resourceId: 'api.analytics',
    sortOrder: 80,
    category: 'operations',
    span: 'two-thirds',
  },
  {
    id: 'patient-growth',
    moduleId: 'analytics',
    componentKey: 'widget.dashboard.patientGrowth',
    labelKey: 'dashboard.widgets.patientGrowth',
    resourceId: 'api.analytics',
    sortOrder: 90,
    category: 'clinical',
    span: 'two-thirds',
  },
  {
    id: 'branch-performance',
    moduleId: 'analytics',
    componentKey: 'widget.dashboard.branchPerformance',
    labelKey: 'dashboard.widgets.branchPerformance',
    resourceId: 'api.analytics',
    sortOrder: 100,
    category: 'operations',
    span: 'half',
  },
  {
    id: 'doctor-performance',
    moduleId: 'emr',
    componentKey: 'widget.dashboard.doctorPerformance',
    labelKey: 'dashboard.widgets.doctorPerformance',
    resourceId: 'api.emr',
    sortOrder: 110,
    category: 'clinical',
    span: 'half',
  },
  {
    id: 'treatment-stats',
    moduleId: 'emr',
    componentKey: 'widget.dashboard.treatmentStats',
    labelKey: 'dashboard.widgets.treatmentStats',
    resourceId: 'api.emr',
    sortOrder: 120,
    category: 'clinical',
    span: 'half',
  },
  {
    id: 'inventory-alerts',
    moduleId: 'inventory',
    componentKey: 'widget.dashboard.inventoryAlerts',
    labelKey: 'dashboard.widgets.inventoryAlerts',
    resourceId: 'api.inventory',
    sortOrder: 130,
    category: 'inventory',
    span: 'half',
  },
  {
    id: 'low-stock',
    moduleId: 'inventory',
    componentKey: 'widget.dashboard.lowStock',
    labelKey: 'dashboard.widgets.lowStock',
    resourceId: 'api.inventory',
    sortOrder: 140,
    category: 'inventory',
    span: 'half',
  },
  {
    id: 'subscription-status',
    moduleId: 'settings',
    componentKey: 'widget.dashboard.subscriptionStatus',
    labelKey: 'dashboard.widgets.subscriptionStatus',
    resourceId: 'api.subscription',
    sortOrder: 150,
    category: 'platform',
    span: 'half',
  },
  {
    id: 'notifications',
    moduleId: 'notifications',
    componentKey: 'widget.dashboard.notifications',
    labelKey: 'dashboard.widgets.notifications',
    resourceId: 'api.notifications',
    sortOrder: 160,
    category: 'platform',
    span: 'half',
  },
  {
    id: 'recent-activities',
    moduleId: 'settings',
    componentKey: 'widget.dashboard.recentActivities',
    labelKey: 'dashboard.widgets.activities',
    resourceId: 'api.audit',
    sortOrder: 170,
    category: 'operations',
    span: 'half',
  },
  {
    id: 'tasks-reminders',
    moduleId: 'workflow',
    componentKey: 'widget.dashboard.tasksReminders',
    labelKey: 'dashboard.widgets.tasksReminders',
    resourceId: 'api.workflow',
    sortOrder: 180,
    category: 'clinical',
    span: 'half',
  },
  {
    id: 'business-health',
    moduleId: 'analytics',
    componentKey: 'widget.dashboard.businessHealth',
    labelKey: 'dashboard.widgets.businessHealth',
    resourceId: 'api.analytics',
    sortOrder: 190,
    category: 'finance',
    span: 'full',
  },
] as const;

export function getCanonicalWidget(id: CanonicalDashboardWidgetId): CanonicalDashboardWidget {
  const widget = CANONICAL_DASHBOARD_WIDGETS.find((entry) => entry.id === id);
  if (!widget) {
    throw new Error(`Unknown canonical dashboard widget: ${id}`);
  }
  return widget;
}

export function listCanonicalWidgetIds(): CanonicalDashboardWidgetId[] {
  return [...CANONICAL_DASHBOARD_WIDGET_IDS];
}

export function listCanonicalComponentKeys(): Record<CanonicalDashboardWidgetId, string> {
  return Object.fromEntries(
    CANONICAL_DASHBOARD_WIDGETS.map((widget) => [widget.id, widget.componentKey]),
  ) as Record<CanonicalDashboardWidgetId, string>;
}

export function resolveCanonicalModuleIdForResource(resourceId?: string): LicensedModuleId | 'core' {
  if (!resourceId) return 'core';
  return CANONICAL_RESOURCE_TO_MODULE[resourceId] ?? 'core';
}
