import type { EffectiveModuleView, LicensedModuleId } from '@booking/module-registry';
import { CANONICAL_REPORT_TEMPLATES } from '@booking/module-registry/reporting';
import type {
  AnalyticsCapabilities,
  AnalyticsCatalogEntry,
  AnalyticsContributionView,
  AnalyticsSnapshot,
} from './analytics-types';

interface AnalyticsExtensionPayload {
  descriptionKey?: string;
  analyticsId?: string;
  analyticsKind?: 'domain' | 'widget' | 'hub';
  localId?: string;
  categoryId?: string;
  dataDomain?: string;
  route?: string;
  deepLinkTemplate?: string;
  permissionAction?: 'view' | 'create' | 'export';
  permissionResource?: string;
  permissionResources?: string[];
  featureId?: string;
  metricIds?: string[];
  primaryMetricId?: string;
  widgetCatalogId?: string;
  reportLinkIds?: string[];
  dashboardWidgetIds?: string[];
  exportFormats?: string[];
  filterProfile?: string;
  iconKey?: string;
  chartType?: AnalyticsContributionView['chartType'];
  size?: AnalyticsContributionView['size'];
  providerKey?: string;
  classification?: string;
  sortOrder?: number;
  userAccessible?: boolean;
}

const HUB_ANALYTICS_IDS = new Set(['hub.catalog', 'hub.builder', 'hub.export-center']);

export const SCHEDULABLE_ANALYTICS_REPORT_IDS = new Set(
  CANONICAL_REPORT_TEMPLATES.filter(
    (template) => template.featureId === 'analytics' && template.scheduleAllowed === true,
  ).map((template) => template.reportId),
);

function normalizePermissionResource(payload: AnalyticsExtensionPayload): string {
  if (payload.permissionResource) return payload.permissionResource;
  if (payload.permissionResources?.length) return payload.permissionResources[0];
  return '';
}

/**
 * Extracts analytics contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractAnalyticsContributions(
  modules: EffectiveModuleView[],
): AnalyticsContributionView[] {
  const contributions: AnalyticsContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'analytics') continue;

      const payload = extension.payload as AnalyticsExtensionPayload;
      if (!payload.analyticsId || !payload.deepLinkTemplate || !payload.analyticsKind) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId as LicensedModuleId,
        analyticsId: payload.analyticsId,
        analyticsKind: payload.analyticsKind,
        localId: payload.localId ?? payload.analyticsId,
        categoryId: payload.categoryId ?? 'platform',
        dataDomain: payload.dataDomain ?? payload.analyticsId,
        labelKey: extension.labelKey,
        descriptionKey: payload.descriptionKey,
        iconKey: payload.iconKey,
        route: payload.route,
        deepLinkTemplate: payload.deepLinkTemplate,
        permissionAction: payload.permissionAction ?? 'view',
        permissionResource: normalizePermissionResource(payload),
        permissionResources: payload.permissionResources,
        featureId: payload.featureId,
        metricIds: payload.metricIds,
        primaryMetricId: payload.primaryMetricId,
        widgetCatalogId: payload.widgetCatalogId,
        reportLinkIds: payload.reportLinkIds,
        dashboardWidgetIds: payload.dashboardWidgetIds,
        exportFormats: payload.exportFormats,
        filterProfile: payload.filterProfile,
        chartType: payload.chartType,
        size: payload.size,
        providerKey: payload.providerKey ?? 'analytics.builtin',
        classification: payload.classification ?? 'operational',
        sortOrder: payload.sortOrder ?? extension.sortOrder,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

export function resolveAccessibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userAccessible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

function isExtensionAccessible(contribution: AnalyticsContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function isCatalogAnalyticsEntryIncluded(
  entry: AnalyticsCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: AnalyticsContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}

export function isHubAnalyticsId(analyticsId: string): boolean {
  return HUB_ANALYTICS_IDS.has(analyticsId);
}

export function isAnalyticsModuleAccessible(modules: EffectiveModuleView[]): boolean {
  const analyticsModule = modules.find((module) => module.moduleId === 'analytics');
  return Boolean(analyticsModule?.userAccessible && analyticsModule.userVisible);
}

export function resolveAnalyticsCapabilities(snapshot: {
  domains: AnalyticsSnapshot['domains'];
  widgets: AnalyticsSnapshot['widgets'];
  hubs: AnalyticsSnapshot['hubs'];
  entries: AnalyticsSnapshot['entries'];
  analyticsModuleAccessible?: boolean;
}): AnalyticsCapabilities {
  const catalogHubVisible = snapshot.hubs.some((hub) => hub.hubId === 'catalog');
  const builderHubVisible = snapshot.hubs.some((hub) => hub.hubId === 'builder');
  const exportHubVisible = snapshot.hubs.some((hub) => hub.hubId === 'export-center');

  const hasCreateAction = snapshot.entries.some((entry) => entry.permissionAction === 'create');
  const hasExportAction = snapshot.entries.some((entry) => entry.permissionAction === 'export');

  const canViewAnalytics =
    snapshot.domains.length > 0 ||
    catalogHubVisible ||
    Boolean(snapshot.analyticsModuleAccessible);

  const canCreateDashboards =
    builderHubVisible ||
    hasCreateAction ||
    snapshot.domains.some((domain) => domain.domainId === 'forecasting');

  const canExportAnalytics =
    exportHubVisible ||
    hasExportAction ||
    snapshot.hubs.some((hub) => hub.hubId === 'export-center' && (hub.exportFormats?.length ?? 0) > 0);

  const hasSchedulableReportLink = snapshot.entries.some((entry) =>
    entry.reportLinkIds.some((reportId) => SCHEDULABLE_ANALYTICS_REPORT_IDS.has(reportId)),
  );

  const canScheduleAnalytics =
    hasSchedulableReportLink && (canExportAnalytics || canCreateDashboards);

  return {
    canViewAnalytics,
    canCreateDashboards,
    canExportAnalytics,
    canScheduleAnalytics,
  };
}

export function resolveAnalyticsCapabilitiesFromSnapshot(
  snapshot: AnalyticsSnapshot,
): AnalyticsCapabilities {
  return {
    canViewAnalytics: snapshot.canViewAnalytics,
    canCreateDashboards: snapshot.canCreateDashboards,
    canExportAnalytics: snapshot.canExportAnalytics,
    canScheduleAnalytics: snapshot.canScheduleAnalytics,
  };
}
