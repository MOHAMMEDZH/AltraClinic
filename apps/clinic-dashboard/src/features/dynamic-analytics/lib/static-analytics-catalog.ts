import {
  CANONICAL_ANALYTICS_DOMAINS,
  CANONICAL_ANALYTICS_HUBS,
  CANONICAL_ANALYTICS_WIDGETS,
  CANONICAL_CROSS_MODULE_ANALYTICS,
} from '@booking/module-registry/analytics';

import {
  STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY,
  isStaticAnalyticsCatalogRuntimeAuthority,
} from '@booking/module-registry/analytics';

export { STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY, isStaticAnalyticsCatalogRuntimeAuthority };

import type { AnalyticsCatalogEntry } from './analytics-types';
import type { LicensedModuleId } from '@booking/module-registry';

export type { AnalyticsCatalogEntry };

function domainToEntry(domain: (typeof CANONICAL_ANALYTICS_DOMAINS)[number]): AnalyticsCatalogEntry {
  return {
    extensionId: `${domain.moduleId}/analytics/${domain.localId}`,
    moduleId: domain.moduleId as LicensedModuleId,
    localId: domain.localId,
    analyticsId: domain.analyticsId,
    analyticsKind: domain.analyticsKind,
    categoryId: domain.categoryId,
    dataDomain: domain.dataDomain,
    labelKey: domain.titleKey,
    descriptionKey: domain.descriptionKey,
    iconKey: domain.iconKey,
    route: domain.route,
    deepLinkTemplate: domain.deepLinkTemplate,
    permissionAction: domain.permissionAction,
    permissionResource: domain.permissionResource,
    permissionResources: domain.permissionResources,
    featureId: domain.featureId,
    metricIds: domain.metricIds,
    reportLinkIds: domain.reportLinkIds,
    dashboardWidgetIds: domain.dashboardWidgetIds,
    filterProfile: domain.filterProfile,
    providerKey: domain.providerKey,
    classification: domain.classification,
    sortOrder: domain.sortOrder,
    schemaVersion: 1,
  };
}

function widgetToEntry(widget: (typeof CANONICAL_ANALYTICS_WIDGETS)[number]): AnalyticsCatalogEntry {
  return {
    extensionId: `${widget.moduleId}/analytics/${widget.localId}`,
    moduleId: widget.moduleId as LicensedModuleId,
    localId: widget.localId,
    analyticsId: widget.analyticsId,
    analyticsKind: widget.analyticsKind,
    categoryId: widget.categoryId,
    dataDomain: widget.dataDomain,
    labelKey: widget.titleKey,
    descriptionKey: widget.descriptionKey,
    deepLinkTemplate: `/analytics/builder?widget=${widget.widgetCatalogId}`,
    permissionAction: widget.permissionAction,
    permissionResource: widget.permissionResource,
    featureId: widget.featureId,
    metricIds: widget.metricIds,
    primaryMetricId: widget.primaryMetricId,
    widgetCatalogId: widget.widgetCatalogId,
    providerKey: widget.providerKey,
    classification: widget.classification,
    sortOrder: widget.sortOrder,
    schemaVersion: 1,
  };
}

function hubToEntry(hub: (typeof CANONICAL_ANALYTICS_HUBS)[number]): AnalyticsCatalogEntry {
  return {
    extensionId: `${hub.moduleId}/analytics/${hub.localId}`,
    moduleId: hub.moduleId as LicensedModuleId,
    localId: hub.localId,
    analyticsId: hub.analyticsId,
    analyticsKind: hub.analyticsKind,
    categoryId: hub.categoryId,
    dataDomain: hub.dataDomain,
    labelKey: hub.titleKey,
    descriptionKey: hub.descriptionKey,
    route: hub.route,
    deepLinkTemplate: hub.deepLinkTemplate,
    permissionAction: hub.permissionAction,
    permissionResource: hub.permissionResource,
    permissionResources: hub.permissionResources,
    featureId: hub.featureId,
    exportFormats: hub.exportFormats,
    providerKey: hub.providerKey,
    classification: hub.classification,
    sortOrder: hub.sortOrder,
    schemaVersion: 1,
  };
}

/**
 * Parity baseline generated from canonical registry vocabulary.
 * NOT runtime authority — see STATIC_ANALYTICS_CATALOG_IS_RUNTIME_AUTHORITY (Phase 34a M3).
 * Phase 34b DynamicAnalyticsProvider consumes EffectiveModuleView via registry snapshot.
 */
export const STATIC_ANALYTICS_CATALOG: AnalyticsCatalogEntry[] = [
  ...CANONICAL_ANALYTICS_DOMAINS.map(domainToEntry),
  ...CANONICAL_ANALYTICS_WIDGETS.map(widgetToEntry),
  ...CANONICAL_ANALYTICS_HUBS.map(hubToEntry),
  ...CANONICAL_CROSS_MODULE_ANALYTICS.map(widgetToEntry),
];
