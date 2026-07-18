import {
  CANONICAL_DASHBOARD_WIDGET_IDS,
  listCanonicalComponentKeys,
  type CanonicalDashboardWidgetId,
} from '@booking/module-registry/dashboard';
import type { DashboardWidgetId } from '@/features/dashboard/config/dashboard-config';
import { listCatalogWidgetIds } from './static-dashboard-catalog';

/**
 * Widget component registry — canonical componentKey map from @booking/module-registry.
 */
export const DASHBOARD_WIDGET_COMPONENT_KEYS: Record<DashboardWidgetId, string> =
  listCanonicalComponentKeys() as Record<DashboardWidgetId, string>;

export function listRegisteredWidgetIds(): DashboardWidgetId[] {
  return listCatalogWidgetIds();
}

export function resolveWidgetComponentKey(widgetId: DashboardWidgetId): string {
  return DASHBOARD_WIDGET_COMPONENT_KEYS[widgetId];
}

/** Ensures clinic dashboard catalog IDs match the canonical registry vocabulary. */
export function assertCanonicalWidgetParity(): void {
  const catalogIds = listCatalogWidgetIds().sort();
  const canonicalIds = [...CANONICAL_DASHBOARD_WIDGET_IDS].sort();
  if (catalogIds.join('|') !== canonicalIds.join('|')) {
    throw new Error(
      `Dashboard widget ID drift: catalog=[${catalogIds.join(', ')}] canonical=[${canonicalIds.join(', ')}]`,
    );
  }

  for (const id of catalogIds) {
    const key = DASHBOARD_WIDGET_COMPONENT_KEYS[id as CanonicalDashboardWidgetId];
    if (!key) {
      throw new Error(`Missing componentKey for widget ${id}`);
    }
  }
}
