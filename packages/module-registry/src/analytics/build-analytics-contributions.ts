import type { LicensedModuleId, AnalyticsContribution } from '../types';
import { moduleAnalytics } from '../builtin/extension-builders';
import { CANONICAL_ANALYTICS_DOMAINS } from './canonical-analytics-domains';
import { CANONICAL_ANALYTICS_HUBS } from './canonical-analytics-hubs';
import { CANONICAL_ANALYTICS_WIDGETS } from './canonical-analytics-widgets';
import { CANONICAL_CROSS_MODULE_ANALYTICS } from './canonical-cross-module-analytics';
import type { CanonicalAnalyticsDomain, CanonicalAnalyticsHub, CanonicalAnalyticsWidget } from './analytics-types';

function domainToContribution(domain: CanonicalAnalyticsDomain): AnalyticsContribution {
  return moduleAnalytics(domain.moduleId, domain.localId, {
    analyticsId: domain.analyticsId,
    labelKey: domain.titleKey,
    descriptionKey: domain.descriptionKey,
    sortOrder: domain.sortOrder,
    analyticsKind: domain.analyticsKind,
    categoryId: domain.categoryId,
    dataDomain: domain.dataDomain,
    classification: domain.classification,
    iconKey: domain.iconKey,
    route: domain.route,
    deepLinkTemplate: domain.deepLinkTemplate,
    permissionAction: domain.permissionAction,
    permissionResource: domain.permissionResource,
    permissionResources: domain.permissionResources,
    featureId: domain.featureId,
    metricIds: domain.metricIds,
    primaryMetricId: domain.metricIds[0],
    reportLinkIds: domain.reportLinkIds,
    dashboardWidgetIds: domain.dashboardWidgetIds,
    filterProfile: domain.filterProfile,
    providerKey: domain.providerKey,
    resourceId: domain.permissionResource,
  });
}

function widgetToContribution(widget: CanonicalAnalyticsWidget): AnalyticsContribution {
  return moduleAnalytics(widget.moduleId, widget.localId, {
    analyticsId: widget.analyticsId,
    labelKey: widget.titleKey,
    descriptionKey: widget.descriptionKey,
    sortOrder: widget.sortOrder,
    analyticsKind: widget.analyticsKind,
    categoryId: widget.categoryId,
    dataDomain: widget.dataDomain,
    classification: widget.classification,
    widgetCatalogId: widget.widgetCatalogId,
    primaryMetricId: widget.primaryMetricId,
    metricIds: widget.metricIds,
    visualizationTypes: widget.visualizationTypes,
    permissionAction: widget.permissionAction,
    permissionResource: widget.permissionResource,
    featureId: widget.featureId,
    deepLinkTemplate: `/analytics/builder?widget=${widget.widgetCatalogId}`,
    providerKey: widget.providerKey,
    resourceId: widget.permissionResource,
  });
}

function hubToContribution(hub: CanonicalAnalyticsHub): AnalyticsContribution {
  return moduleAnalytics(hub.moduleId, hub.localId, {
    analyticsId: hub.analyticsId,
    labelKey: hub.titleKey,
    descriptionKey: hub.descriptionKey,
    sortOrder: hub.sortOrder,
    analyticsKind: hub.analyticsKind,
    categoryId: hub.categoryId,
    dataDomain: hub.dataDomain,
    classification: hub.classification,
    route: hub.route,
    deepLinkTemplate: hub.deepLinkTemplate,
    permissionAction: hub.permissionAction,
    permissionResource: hub.permissionResource,
    permissionResources: hub.permissionResources,
    featureId: hub.featureId,
    exportFormats: hub.exportFormats,
    providerKey: hub.providerKey,
    resourceId: hub.permissionResource,
  });
}

export function buildAnalyticsContributionsForModule(moduleId: LicensedModuleId): AnalyticsContribution[] {
  const domains = CANONICAL_ANALYTICS_DOMAINS.filter((entry) => entry.moduleId === moduleId).map(domainToContribution);
  const widgets = CANONICAL_ANALYTICS_WIDGETS.filter((entry) => entry.moduleId === moduleId).map(widgetToContribution);
  const hubs = CANONICAL_ANALYTICS_HUBS.filter((entry) => entry.moduleId === moduleId).map(hubToContribution);
  const crossModule = CANONICAL_CROSS_MODULE_ANALYTICS.filter((entry) => entry.moduleId === moduleId).map(
    widgetToContribution,
  );
  return [...domains, ...widgets, ...hubs, ...crossModule];
}

export function buildAllAnalyticsContributions(): AnalyticsContribution[] {
  return [
    ...CANONICAL_ANALYTICS_DOMAINS.map(domainToContribution),
    ...CANONICAL_ANALYTICS_WIDGETS.map(widgetToContribution),
    ...CANONICAL_ANALYTICS_HUBS.map(hubToContribution),
    ...CANONICAL_CROSS_MODULE_ANALYTICS.map(widgetToContribution),
  ];
}
