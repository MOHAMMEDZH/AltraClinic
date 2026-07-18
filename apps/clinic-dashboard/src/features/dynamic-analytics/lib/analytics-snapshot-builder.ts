import { hasPermission } from '@booking/permissions';
import { CANONICAL_ANALYTICS_METRICS } from '@booking/module-registry/analytics';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { AnalyticsDomainId } from '@/features/analytics/config/analytics-catalog';
import {
  buildAnalyticsPermCheck,
  canViewAnalyticsDomain,
} from '@/features/analytics/config/analytics-config';
import {
  extractAnalyticsContributions,
  isAnalyticsModuleAccessible,
  isCatalogAnalyticsEntryIncluded,
  isHubAnalyticsId,
  resolveAccessibleModuleIds,
  resolveAnalyticsCapabilities,
} from './analytics-resolver';
import type {
  AnalyticsCatalogEntry,
  AnalyticsCatalogSource,
  AnalyticsCategorySnapshot,
  AnalyticsDomainSnapshot,
  AnalyticsHubSnapshot,
  AnalyticsMetricDefinitionSnapshot,
  AnalyticsSnapshot,
  AnalyticsSnapshotEntry,
  AnalyticsSnapshotIdentity,
  AnalyticsWidgetSnapshot,
} from './analytics-types';

export interface BuildAnalyticsSnapshotOptions {
  roles: string[];
  catalog: AnalyticsCatalogEntry[];
  modules: EffectiveModuleView[];
  source: AnalyticsCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: AnalyticsSnapshotIdentity;
  includeAllPermitted?: boolean;
}

const METRIC_BY_ID = new Map(
  CANONICAL_ANALYTICS_METRICS.map((metric) => [metric.metricId, metric]),
);

function toDomainSnapshot(entry: AnalyticsCatalogEntry): AnalyticsDomainSnapshot | null {
  if (entry.analyticsKind !== 'domain' || !entry.route) return null;

  return {
    kind: 'domain',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    domainId: entry.localId as AnalyticsDomainId,
    analyticsId: entry.analyticsId,
    categoryId: entry.categoryId,
    dataDomain: entry.dataDomain,
    titleKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    iconKey: entry.iconKey ?? 'layout',
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    permissionAction: entry.permissionAction,
    permissionResource: entry.permissionResource,
    permissionResources: entry.permissionResources,
    featureId: entry.featureId,
    metricIds: entry.metricIds ?? [],
    reportLinkIds: entry.reportLinkIds ?? [],
    dashboardWidgetIds: entry.dashboardWidgetIds ?? [],
    filterProfile: entry.filterProfile,
    providerKey: entry.providerKey,
    classification: entry.classification,
    sortOrder: entry.sortOrder,
  };
}

function toWidgetSnapshot(entry: AnalyticsCatalogEntry): AnalyticsWidgetSnapshot | null {
  if (entry.analyticsKind !== 'widget' || !entry.widgetCatalogId || !entry.primaryMetricId) {
    return null;
  }

  return {
    kind: 'widget',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    widgetCatalogId: entry.widgetCatalogId,
    analyticsId: entry.analyticsId,
    categoryId: entry.categoryId,
    dataDomain: entry.dataDomain,
    titleKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    primaryMetricId: entry.primaryMetricId,
    metricIds: entry.metricIds ?? [entry.primaryMetricId],
    chartType: entry.chartType ?? 'bar',
    size: entry.size ?? 'medium',
    deepLinkTemplate: entry.deepLinkTemplate,
    permissionAction: entry.permissionAction,
    permissionResource: entry.permissionResource,
    featureId: entry.featureId,
    providerKey: entry.providerKey,
    classification: entry.classification,
    sortOrder: entry.sortOrder,
  };
}

function toHubSnapshot(entry: AnalyticsCatalogEntry): AnalyticsHubSnapshot | null {
  if (entry.analyticsKind !== 'hub' || !entry.route) return null;

  return {
    kind: 'hub',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId,
    hubId: entry.localId,
    analyticsId: entry.analyticsId,
    categoryId: entry.categoryId,
    dataDomain: entry.dataDomain,
    titleKey: entry.labelKey,
    descriptionKey: entry.descriptionKey ?? entry.labelKey,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    permissionAction: entry.permissionAction,
    permissionResource: entry.permissionResource,
    permissionResources: entry.permissionResources,
    featureId: entry.featureId,
    exportFormats: entry.exportFormats,
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
  };
}

function toSnapshotEntry(
  entry: AnalyticsCatalogEntry,
): AnalyticsSnapshotEntry | null {
  if (isHubAnalyticsId(entry.analyticsId) && entry.analyticsKind === 'hub') {
    return {
      analyticsId: entry.analyticsId,
      extensionId: entry.extensionId,
      moduleId: entry.moduleId,
      analyticsKind: entry.analyticsKind,
      labelKey: entry.labelKey,
      route: entry.route,
      deepLinkTemplate: entry.deepLinkTemplate,
      metricIds: entry.metricIds ?? [],
      reportLinkIds: entry.reportLinkIds ?? [],
      dashboardWidgetIds: entry.dashboardWidgetIds ?? [],
      classification: entry.classification,
      sortOrder: entry.sortOrder,
      permissionAction: entry.permissionAction,
    };
  }

  if (entry.analyticsKind === 'domain' || entry.analyticsKind === 'widget') {
    return {
      analyticsId: entry.analyticsId,
      extensionId: entry.extensionId,
      moduleId: entry.moduleId,
      analyticsKind: entry.analyticsKind,
      labelKey: entry.labelKey,
      route: entry.route,
      deepLinkTemplate: entry.deepLinkTemplate,
      metricIds: entry.metricIds ?? [],
      reportLinkIds: entry.reportLinkIds ?? [],
      dashboardWidgetIds: entry.dashboardWidgetIds ?? [],
      classification: entry.classification,
      sortOrder: entry.sortOrder,
      permissionAction: entry.permissionAction,
    };
  }

  return null;
}

function sortDomains(entries: AnalyticsDomainSnapshot[]): AnalyticsDomainSnapshot[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.domainId.localeCompare(b.domainId),
  );
}

function sortWidgets(entries: AnalyticsWidgetSnapshot[]): AnalyticsWidgetSnapshot[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.widgetCatalogId.localeCompare(b.widgetCatalogId),
  );
}

function sortHubs(entries: AnalyticsHubSnapshot[]): AnalyticsHubSnapshot[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.hubId.localeCompare(b.hubId),
  );
}

function sortEntries(entries: AnalyticsSnapshotEntry[]): AnalyticsSnapshotEntry[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.analyticsId.localeCompare(b.analyticsId),
  );
}

function buildCategories(domains: AnalyticsDomainSnapshot[]): AnalyticsCategorySnapshot[] {
  const counts = new Map<string, number>();
  for (const domain of domains) {
    counts.set(domain.categoryId, (counts.get(domain.categoryId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryId, domainCount]) => ({
      categoryId,
      labelKey: `analytics.domains.${categoryId}.title`,
      domainCount,
    }));
}

function buildMetrics(entries: AnalyticsSnapshotEntry[]): AnalyticsMetricDefinitionSnapshot[] {
  const metricIds = new Set<string>();
  for (const entry of entries) {
    for (const metricId of entry.metricIds) {
      metricIds.add(metricId);
    }
  }

  return [...metricIds]
    .sort()
    .map((metricId) => METRIC_BY_ID.get(metricId))
    .filter((metric): metric is NonNullable<typeof metric> => Boolean(metric))
    .map((metric) => ({
      metricId: metric.metricId,
      labelKey: metric.labelKey,
      descriptionKey: metric.descriptionKey,
      unit: metric.unit,
      format: metric.format,
      categoryId: metric.categoryId,
      dataDomain: metric.dataDomain,
      providerKey: metric.providerKey,
    }));
}

function buildLookups(
  domains: AnalyticsDomainSnapshot[],
  widgets: AnalyticsWidgetSnapshot[],
  hubs: AnalyticsHubSnapshot[],
): Pick<AnalyticsSnapshot, 'deepLinkByAnalyticsId' | 'labelKeyByAnalyticsId' | 'providerKeys'> {
  const deepLinkByAnalyticsId: Record<string, string> = {};
  const labelKeyByAnalyticsId: Record<string, string> = {};
  const providerKeySet = new Set<string>();

  for (const entry of [...domains, ...widgets, ...hubs]) {
    deepLinkByAnalyticsId[entry.analyticsId] = entry.deepLinkTemplate;
    labelKeyByAnalyticsId[entry.analyticsId] = entry.titleKey;
    providerKeySet.add(entry.providerKey);
  }

  return {
    deepLinkByAnalyticsId,
    labelKeyByAnalyticsId,
    providerKeys: [...providerKeySet].sort(),
  };
}

function isStaticEntryPermitted(entry: AnalyticsCatalogEntry, roles: string[]): boolean {
  if (entry.analyticsKind === 'domain') {
    return canViewAnalyticsDomain(
      entry.localId as AnalyticsDomainId,
      buildAnalyticsPermCheck(roles),
    );
  }

  return hasPermission(
    roles,
    entry.permissionResource as never,
    entry.permissionAction as never,
  );
}

function filterStaticEntries(catalog: AnalyticsCatalogEntry[], roles: string[]): AnalyticsCatalogEntry[] {
  return catalog.filter((entry) => isStaticEntryPermitted(entry, roles));
}

function filterRegistryEntries(
  catalog: AnalyticsCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractAnalyticsContributions>,
): AnalyticsCatalogEntry[] {
  return catalog.filter((entry) => isCatalogAnalyticsEntryIncluded(entry, modules, contributions));
}

export function buildAnalyticsSnapshot(options: BuildAnalyticsSnapshotOptions): AnalyticsSnapshot {
  const contributions = extractAnalyticsContributions(options.modules);
  const includedCatalog = options.includeAllPermitted
    ? filterStaticEntries(options.catalog, options.roles)
    : filterRegistryEntries(options.catalog, options.modules, contributions);

  const domains = sortDomains(
    includedCatalog
      .filter((entry) => entry.analyticsKind === 'domain')
      .map(toDomainSnapshot)
      .filter((entry): entry is AnalyticsDomainSnapshot => Boolean(entry)),
  );

  const widgets = sortWidgets(
    includedCatalog
      .filter((entry) => entry.analyticsKind === 'widget')
      .map(toWidgetSnapshot)
      .filter((entry): entry is AnalyticsWidgetSnapshot => Boolean(entry)),
  );

  const hubs = sortHubs(
    includedCatalog
      .filter((entry) => entry.analyticsKind === 'hub')
      .map(toHubSnapshot)
      .filter((entry): entry is AnalyticsHubSnapshot => Boolean(entry)),
  );

  const entries = sortEntries(
    includedCatalog
      .map(toSnapshotEntry)
      .filter((entry): entry is AnalyticsSnapshotEntry => Boolean(entry)),
  );

  const analyticsModuleAccessible = options.includeAllPermitted
    ? hasPermission(options.roles, 'api.analytics' as never, 'view' as never)
    : isAnalyticsModuleAccessible(options.modules);

  const capabilities = resolveAnalyticsCapabilities({
    domains,
    widgets,
    hubs,
    entries,
    analyticsModuleAccessible,
  });

  const enabledModuleIds = options.includeAllPermitted
    ? [...new Set([...domains, ...widgets, ...hubs].map((entry) => entry.moduleId))].sort()
    : [...resolveAccessibleModuleIds(options.modules)].sort();

  const lookups = buildLookups(domains, widgets, hubs);

  return {
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    identity: options.identity,
    generatedAt: new Date().toISOString(),
    entries,
    domains,
    widgets,
    hubs,
    categories: buildCategories(domains),
    metrics: buildMetrics(entries),
    capabilities,
    enabledModuleIds,
    ...lookups,
    ...capabilities,
  };
}

export function buildRegistryAnalyticsSnapshot(
  roles: string[],
  catalog: AnalyticsCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: AnalyticsSnapshotIdentity,
): AnalyticsSnapshot {
  return buildAnalyticsSnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    includeAllPermitted: false,
  });
}

export function buildStaticAnalyticsSnapshot(
  roles: string[],
  catalog: AnalyticsCatalogEntry[],
  identity: AnalyticsSnapshotIdentity,
  source: Extract<AnalyticsCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): AnalyticsSnapshot {
  return buildAnalyticsSnapshot({
    roles,
    catalog,
    modules: [],
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    includeAllPermitted: true,
  });
}

/** Fail-closed registry placeholder while bootstrap resolves — never widens analytics surface. */
export function buildRestrictedAnalyticsSnapshot(
  identity: AnalyticsSnapshotIdentity,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): AnalyticsSnapshot {
  const capabilities = {
    canViewAnalytics: false,
    canCreateDashboards: false,
    canExportAnalytics: false,
    canScheduleAnalytics: false,
  };

  return {
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    generatedAt: new Date().toISOString(),
    entries: [],
    domains: [],
    widgets: [],
    hubs: [],
    categories: [],
    metrics: [],
    capabilities,
    enabledModuleIds: [],
    providerKeys: [],
    deepLinkByAnalyticsId: {},
    labelKeyByAnalyticsId: {},
    ...capabilities,
  };
}

export function getSnapshotDomainById(
  snapshot: AnalyticsSnapshot,
  domainId: AnalyticsDomainId,
): AnalyticsDomainSnapshot | undefined {
  return snapshot.domains.find((domain) => domain.domainId === domainId);
}

export function getSnapshotWidgetByCatalogId(
  snapshot: AnalyticsSnapshot,
  widgetCatalogId: string,
): AnalyticsWidgetSnapshot | undefined {
  return snapshot.widgets.find((widget) => widget.widgetCatalogId === widgetCatalogId);
}
