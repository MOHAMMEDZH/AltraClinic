import type { DashboardWidgetId } from '@/features/dashboard/config/dashboard-config';
import { resolveDashboardProfile } from '@/features/dashboard/config/dashboard-config';
import type { DashboardCatalogEntry, DashboardCatalogSource, DashboardSnapshot } from './dashboard-types';
import { extractDashboardContributions, isCatalogWidgetIncluded } from './dashboard-resolver';
import { getCatalogEntry, getProfileWidgetOrder } from './static-dashboard-catalog';

export interface BuildDashboardSnapshotOptions {
  roles: string[];
  catalog: readonly DashboardCatalogEntry[];
  modules: import('@booking/module-registry').EffectiveModuleView[];
  source: DashboardCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  /** When true, include all profile widgets without registry filtering (static parity / rollback). */
  includeAll?: boolean;
}

function filterProfileWidgets(
  profileWidgetIds: DashboardWidgetId[],
  catalog: readonly DashboardCatalogEntry[],
  modules: BuildDashboardSnapshotOptions['modules'],
  includeAll: boolean,
): DashboardWidgetId[] {
  if (includeAll) return profileWidgetIds;

  const contributions = extractDashboardContributions(modules);
  const catalogById = new Map(catalog.map((entry) => [entry.id, entry]));

  return profileWidgetIds.filter((widgetId) => {
    const entry = catalogById.get(widgetId) ?? getCatalogEntry(widgetId);
    if (!entry) return false;
    return isCatalogWidgetIncluded(entry, modules, contributions);
  });
}

export function buildDashboardSnapshot(options: BuildDashboardSnapshotOptions): DashboardSnapshot {
  const profile = resolveDashboardProfile(options.roles);
  const profileWidgetIds = getProfileWidgetOrder(profile);
  const widgetIds = filterProfileWidgets(
    profileWidgetIds,
    options.catalog,
    options.modules,
    options.includeAll ?? false,
  );

  return {
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    profile,
    widgetIds,
  };
}

export function buildRegistryDashboardSnapshot(
  roles: string[],
  catalog: readonly DashboardCatalogEntry[],
  modules: BuildDashboardSnapshotOptions['modules'],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
): DashboardSnapshot {
  return buildDashboardSnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    includeAll: false,
  });
}

export function buildStaticDashboardSnapshot(
  roles: string[],
  catalog: readonly DashboardCatalogEntry[],
): DashboardSnapshot {
  return buildDashboardSnapshot({
    roles,
    catalog,
    modules: [],
    source: 'static-only',
    catalogGeneration: null,
    entitlementVersion: null,
    includeAll: true,
  });
}
