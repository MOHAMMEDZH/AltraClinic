import type { DashboardWidgetId } from '@/features/dashboard/config/dashboard-config';
import {
  DASHBOARD_PROFILE_WIDGETS,
  DASHBOARD_WIDGET_DEFINITIONS,
  WIDGET_CATEGORY,
} from '@/features/dashboard/config/dashboard-config';
import { resolveModuleIdForResource } from './resource-module-map';
import type { DashboardCatalogEntry } from './dashboard-types';

/**
 * Authoritative static dashboard widget catalog — parity baseline for Phase 31.
 * Widget definitions and profile ordering match `dashboard-config.ts` exactly.
 */
export const STATIC_DASHBOARD_CATALOG: DashboardCatalogEntry[] = (
  Object.keys(DASHBOARD_WIDGET_DEFINITIONS) as DashboardWidgetId[]
).map((id) => {
  const def = DASHBOARD_WIDGET_DEFINITIONS[id];
  return {
    id,
    moduleId: resolveModuleIdForResource(def.resourceId),
    resourceId: def.resourceId,
    span: def.span,
    category: WIDGET_CATEGORY[id],
  };
});

export function getCatalogEntry(widgetId: DashboardWidgetId): DashboardCatalogEntry | undefined {
  return STATIC_DASHBOARD_CATALOG.find((entry) => entry.id === widgetId);
}

export function getProfileWidgetOrder(profile: keyof typeof DASHBOARD_PROFILE_WIDGETS): DashboardWidgetId[] {
  return DASHBOARD_PROFILE_WIDGETS[profile] ?? DASHBOARD_PROFILE_WIDGETS.default;
}

export function listCatalogWidgetIds(): DashboardWidgetId[] {
  return STATIC_DASHBOARD_CATALOG.map((entry) => entry.id);
}
