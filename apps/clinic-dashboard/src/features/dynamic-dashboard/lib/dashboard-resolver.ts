import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import type { DashboardCatalogEntry, DashboardContributionView } from './dashboard-types';

interface ExtensionPayload {
  resourceId?: string;
  userAccessible?: boolean;
}

/**
 * Extracts dashboard contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractDashboardContributions(
  modules: EffectiveModuleView[],
): DashboardContributionView[] {
  const contributions: DashboardContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'dashboard') continue;
      const payload = extension.payload as ExtensionPayload & {
        widgetId?: string;
        componentKey?: string;
        sortOrder?: number;
      };
      if (!payload.widgetId || !payload.componentKey) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        widgetId: payload.widgetId,
        componentKey: payload.componentKey,
        sortOrder: payload.sortOrder ?? 0,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort((a, b) => a.sortOrder - b.sortOrder || a.widgetId.localeCompare(b.widgetId));
}

/**
 * Module IDs the tenant/user may access — derived from EffectiveModuleView only.
 */
export function resolveAccessibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userAccessible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

function isResourceAccessibleInExtensions(
  modules: EffectiveModuleView[],
  resourceId: string,
): boolean {
  for (const moduleView of modules) {
    if (!moduleView.userVisible) continue;
    for (const ext of moduleView.extensions) {
      const payload = ext.payload as ExtensionPayload;
      if (payload.resourceId !== resourceId) continue;
      if (ext.userVisible && payload.userAccessible === true) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Determines if a catalog widget should be included for the current effective views.
 * Core widgets always pass. Resource widgets gate on extension-level access from
 * EffectiveModuleView (no client RBAC duplication).
 */
export function isCatalogWidgetIncluded(
  entry: DashboardCatalogEntry,
  modules: EffectiveModuleView[],
  _contributions: DashboardContributionView[],
): boolean {
  if (entry.moduleId === 'core') return true;
  if (!entry.resourceId) return true;

  return isResourceAccessibleInExtensions(modules, entry.resourceId);
}

/** Module-level gate used in tests and diagnostics. */
export function isCatalogWidgetIncludedByModule(
  moduleId: string,
  modules: EffectiveModuleView[],
  contributions: DashboardContributionView[],
): boolean {
  if (moduleId === 'core') return true;

  const moduleView = modules.find((m) => m.moduleId === moduleId);
  if (!moduleView?.userVisible) return false;

  const moduleContributions = contributions.filter((c) => c.moduleId === moduleId);
  if (moduleContributions.length === 0) {
    return moduleView.userAccessible;
  }

  return (
    moduleView.userAccessible &&
    moduleContributions.some((c) => c.userVisible && c.userAccessible)
  );
}
