import type { ModuleManifest } from '../types';
import {
  CANONICAL_DASHBOARD_WIDGETS,
  CANONICAL_DASHBOARD_WIDGET_IDS,
  listCanonicalComponentKeys,
  type CanonicalDashboardWidgetId,
} from './canonical-dashboard-widgets';

export function validateBuiltinDashboardIntegrity(
  manifests: ModuleManifest[],
): string[] {
  const errors: string[] = [];
  const canonicalIds = new Set<string>(CANONICAL_DASHBOARD_WIDGET_IDS);
  const canonicalById = new Map(
    CANONICAL_DASHBOARD_WIDGETS.map((widget) => [widget.id, widget]),
  );
  const canonicalComponentKeys = listCanonicalComponentKeys();
  const seenWidgetIds = new Map<string, string>();

  for (const manifest of manifests) {
    const dashboard = manifest.extensions.dashboard ?? [];
    for (const contribution of dashboard) {
      const widgetId = contribution.widgetId;
      const owner = `${manifest.moduleId}/dashboard/${widgetId}`;

      if (!canonicalIds.has(widgetId)) {
        errors.push(`Orphan dashboard widgetId "${widgetId}" on module ${manifest.moduleId}`);
        continue;
      }

      const canonical = canonicalById.get(widgetId as CanonicalDashboardWidgetId)!;
      if (canonical.moduleId !== manifest.moduleId) {
        errors.push(
          `Widget "${widgetId}" declared on ${manifest.moduleId} but canonical owner is ${canonical.moduleId}`,
        );
      }

      if (contribution.componentKey !== canonicalComponentKeys[widgetId as CanonicalDashboardWidgetId]) {
        errors.push(
          `Widget "${widgetId}" componentKey mismatch: manifest=${contribution.componentKey} canonical=${canonicalComponentKeys[widgetId as CanonicalDashboardWidgetId]}`,
        );
      }

      if (canonical.resourceId && contribution.resourceId !== canonical.resourceId) {
        errors.push(
          `Widget "${widgetId}" resourceId mismatch: manifest=${contribution.resourceId} canonical=${canonical.resourceId}`,
        );
      }

      if (!canonical.resourceId && contribution.resourceId) {
        errors.push(
          `Widget "${widgetId}" must not declare resourceId in manifest (core widget)`,
        );
      }

      const priorOwner = seenWidgetIds.get(widgetId);
      if (priorOwner) {
        errors.push(`Duplicate dashboard widgetId "${widgetId}" (${priorOwner} and ${owner})`);
      } else {
        seenWidgetIds.set(widgetId, owner);
      }
    }
  }

  for (const widgetId of canonicalIds) {
    if (!seenWidgetIds.has(widgetId)) {
      errors.push(`Missing dashboard contribution for canonical widget "${widgetId}"`);
    }
  }

  return errors;
}
