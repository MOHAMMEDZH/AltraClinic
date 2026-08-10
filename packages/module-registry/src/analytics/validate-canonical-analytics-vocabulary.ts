import { CANONICAL_REPORT_TEMPLATES } from '../reporting/canonical-report-templates';
import { CANONICAL_DASHBOARD_WIDGET_IDS } from '../dashboard/canonical-dashboard-widgets';
import { CANONICAL_ANALYTICS_CATEGORIES, CANONICAL_ANALYTICS_CATEGORY_IDS } from './canonical-analytics-categories';
import { CANONICAL_ANALYTICS_DOMAINS } from './canonical-analytics-domains';
import { CANONICAL_ANALYTICS_HUBS } from './canonical-analytics-hubs';
import { CANONICAL_ANALYTICS_WIDGETS } from './canonical-analytics-widgets';
import { CANONICAL_CROSS_MODULE_ANALYTICS } from './canonical-cross-module-analytics';
import {
  CANONICAL_ANALYTICS_METRICS,
  CANONICAL_METRIC_ID_SET,
} from './canonical-analytics-metrics';
import {
  CANONICAL_ANALYTICS_FEATURE_IDS,
  type AnalyticsExportFormat,
  type AnalyticsPermissionAction,
  type CanonicalAnalyticsMetric,
} from './analytics-types';
import { validateAnalyticsCapabilityContract } from './analytics-capability-contract';

const CATEGORY_IDS = new Set(CANONICAL_ANALYTICS_CATEGORY_IDS);
const VALID_ACTIONS = new Set<AnalyticsPermissionAction>(['view', 'create', 'export']);
const VALID_FEATURE_IDS = new Set<string>(CANONICAL_ANALYTICS_FEATURE_IDS);
const VALID_HUB_IDS = new Set(['catalog', 'builder', 'export-center']);
const VALID_EXPORT_FORMATS = new Set<AnalyticsExportFormat>(['pdf', 'csv', 'excel', 'json', 'xlsx']);
const PROVIDER_KEY_PATTERN = /^[a-z][a-z0-9]*(\.[a-z][a-z0-9-]*)+$/;
const REPORT_IDS = new Set(CANONICAL_REPORT_TEMPLATES.map((template) => template.reportId));
const DASHBOARD_WIDGET_IDS = new Set(CANONICAL_DASHBOARD_WIDGET_IDS);

const REQUIRED_METRIC_FIELDS: (keyof CanonicalAnalyticsMetric)[] = [
  'metricId',
  'labelKey',
  'descriptionKey',
  'unit',
  'format',
  'precision',
  'scope',
  'categoryId',
  'dataDomain',
  'aggregation',
  'providerKey',
  'featureId',
];

function validateCanonicalMetricMetadata(): string[] {
  const errors: string[] = [];
  const seenMetricIds = new Set<string>();

  for (const metric of CANONICAL_ANALYTICS_METRICS) {
    if (seenMetricIds.has(metric.metricId)) {
      errors.push(`Duplicate canonical metricId "${metric.metricId}"`);
    } else {
      seenMetricIds.add(metric.metricId);
    }

    for (const field of REQUIRED_METRIC_FIELDS) {
      const value = metric[field];
      if (value === undefined || value === null || value === '') {
        errors.push(`Metric "${metric.metricId}" missing required field "${field}"`);
      }
    }

    if (typeof metric.precision !== 'number' || metric.precision < 0) {
      errors.push(`Metric "${metric.metricId}" has invalid precision "${String(metric.precision)}"`);
    }

    if (!CATEGORY_IDS.has(metric.categoryId)) {
      errors.push(`Metric "${metric.metricId}" has invalid categoryId "${metric.categoryId}"`);
    }

    if (!metric.providerKey || !PROVIDER_KEY_PATTERN.test(metric.providerKey)) {
      errors.push(`Metric "${metric.metricId}" has invalid providerKey "${metric.providerKey}"`);
    }

    if (!VALID_FEATURE_IDS.has(metric.featureId)) {
      errors.push(`Metric "${metric.metricId}" has invalid featureId "${metric.featureId}"`);
    }
  }

  return errors;
}

function validateWidgetUniqueness(): string[] {
  const errors: string[] = [];
  const allWidgets = [...CANONICAL_ANALYTICS_WIDGETS, ...CANONICAL_CROSS_MODULE_ANALYTICS];

  const seenWidgetCatalogIds = new Map<string, string>();
  const seenWidgetLocalIds = new Map<string, string>();
  const seenWidgetExtensionIds = new Map<string, string>();
  const seenWidgetDeepLinks = new Map<string, string>();
  const analyticsModuleWidgetCatalogIds = new Set(
    CANONICAL_ANALYTICS_WIDGETS.map((widget) => widget.widgetCatalogId),
  );

  for (const widget of allWidgets) {
    const owner = `${widget.moduleId}/analytics/${widget.localId}`;
    const deepLink = `/analytics/builder?widget=${widget.widgetCatalogId}`;

    const priorCatalogId = seenWidgetCatalogIds.get(widget.widgetCatalogId);
    if (priorCatalogId) {
      errors.push(
        `Duplicate widgetCatalogId "${widget.widgetCatalogId}" (${priorCatalogId} and ${owner})`,
      );
    } else {
      seenWidgetCatalogIds.set(widget.widgetCatalogId, owner);
    }

    const priorLocalId = seenWidgetLocalIds.get(widget.localId);
    if (priorLocalId) {
      errors.push(`Duplicate widget localId "${widget.localId}" (${priorLocalId} and ${owner})`);
    } else {
      seenWidgetLocalIds.set(widget.localId, owner);
    }

    const priorExtensionId = seenWidgetExtensionIds.get(owner);
    if (priorExtensionId) {
      errors.push(`Duplicate widget extensionId "${owner}"`);
    } else {
      seenWidgetExtensionIds.set(owner, owner);
    }

    const priorDeepLink = seenWidgetDeepLinks.get(deepLink);
    if (priorDeepLink) {
      errors.push(`Duplicate widget deepLink "${deepLink}" (${priorDeepLink} and ${owner})`);
    } else {
      seenWidgetDeepLinks.set(deepLink, owner);
    }

    if (
      widget.moduleId !== 'analytics' &&
      analyticsModuleWidgetCatalogIds.has(widget.widgetCatalogId)
    ) {
      errors.push(
        `Cross-module widget "${widget.widgetCatalogId}" collides with analytics-module widgetCatalogId`,
      );
    }
  }

  return errors;
}

/** Fail-closed validation of canonical analytics vocabulary (Phase 34a). */
export function validateCanonicalAnalyticsVocabulary(): string[] {
  const errors: string[] = [
    ...validateCanonicalMetricMetadata(),
    ...validateWidgetUniqueness(),
    ...validateAnalyticsCapabilityContract(),
  ];

  if (CANONICAL_ANALYTICS_CATEGORIES.length !== CANONICAL_ANALYTICS_CATEGORY_IDS.length) {
    errors.push('Canonical analytics categories contain duplicate categoryId values');
  }

  const seenAnalyticsIds = new Set<string>();
  const seenDomainIds = new Set<string>();
  const seenExtensionIds = new Map<string, string>();
  const seenRoutes = new Map<string, string>();
  const seenDeepLinks = new Map<string, string>();

  const allEntries = [
    ...CANONICAL_ANALYTICS_DOMAINS,
    ...CANONICAL_ANALYTICS_WIDGETS,
    ...CANONICAL_ANALYTICS_HUBS,
    ...CANONICAL_CROSS_MODULE_ANALYTICS,
  ];

  for (const widget of [...CANONICAL_ANALYTICS_WIDGETS, ...CANONICAL_CROSS_MODULE_ANALYTICS]) {
    if (!CANONICAL_METRIC_ID_SET.has(widget.primaryMetricId)) {
      errors.push(`Widget "${widget.widgetCatalogId}" references unknown primaryMetricId "${widget.primaryMetricId}"`);
    }
    for (const metricId of widget.metricIds) {
      if (!CANONICAL_METRIC_ID_SET.has(metricId)) {
        errors.push(`Widget "${widget.widgetCatalogId}" references unknown metricId "${metricId}"`);
      }
    }
  }

  for (const domain of CANONICAL_ANALYTICS_DOMAINS) {
    if (seenDomainIds.has(domain.domainId)) {
      errors.push(`Duplicate canonical domainId "${domain.domainId}"`);
    } else {
      seenDomainIds.add(domain.domainId);
    }
    for (const metricId of domain.metricIds) {
      if (!CANONICAL_METRIC_ID_SET.has(metricId)) {
        errors.push(`Domain "${domain.domainId}" references unknown metricId "${metricId}"`);
      }
    }
    for (const reportId of domain.reportLinkIds ?? []) {
      if (!REPORT_IDS.has(reportId)) {
        errors.push(`Domain "${domain.domainId}" references unknown reportLinkId "${reportId}"`);
      }
    }
    for (const widgetId of domain.dashboardWidgetIds ?? []) {
      if (!(DASHBOARD_WIDGET_IDS as Set<string>).has(widgetId)) {
        errors.push(`Domain "${domain.domainId}" references unknown dashboardWidgetId "${widgetId}"`);
      }
    }
  }

  for (const hub of CANONICAL_ANALYTICS_HUBS) {
    if (!VALID_HUB_IDS.has(hub.hubId)) {
      errors.push(`Invalid analytics hubId "${hub.hubId}"`);
    }
    if (hub.moduleId !== 'analytics') {
      errors.push(`Hub "${hub.hubId}" must belong to analytics module`);
    }
    for (const format of hub.exportFormats ?? []) {
      if (!VALID_EXPORT_FORMATS.has(format)) {
        errors.push(`Hub "${hub.hubId}" has invalid exportFormat "${format}"`);
      }
    }
  }

  for (const entry of allEntries) {
    const owner = `${entry.moduleId}/analytics/${entry.localId}`;

    const priorExtension = seenExtensionIds.get(owner);
    if (priorExtension) {
      errors.push(`Duplicate extensionId "${owner}" (${priorExtension} and ${owner})`);
    } else {
      seenExtensionIds.set(owner, owner);
    }

    if (seenAnalyticsIds.has(entry.analyticsId)) {
      errors.push(`Duplicate canonical analyticsId "${entry.analyticsId}"`);
    } else {
      seenAnalyticsIds.add(entry.analyticsId);
    }

    if (!CATEGORY_IDS.has(entry.categoryId)) {
      errors.push(`Canonical entry "${entry.analyticsId}" has invalid categoryId "${entry.categoryId}"`);
    }

    if (!entry.providerKey || !PROVIDER_KEY_PATTERN.test(entry.providerKey)) {
      errors.push(`Canonical entry "${entry.analyticsId}" has invalid providerKey "${entry.providerKey}"`);
    }

    const deepLinkTemplate =
      entry.analyticsKind === 'widget'
        ? `/analytics/builder?widget=${entry.widgetCatalogId}`
        : entry.deepLinkTemplate;

    if (!deepLinkTemplate.startsWith('/')) {
      errors.push(`Canonical entry "${entry.analyticsId}" deepLinkTemplate must start with "/"`);
    } else {
      const priorDeepLink = seenDeepLinks.get(deepLinkTemplate);
      if (priorDeepLink) {
        errors.push(`Duplicate deepLinkTemplate "${deepLinkTemplate}" (${priorDeepLink} and ${owner})`);
      } else {
        seenDeepLinks.set(deepLinkTemplate, owner);
      }
    }

    if ('route' in entry && entry.route) {
      if (!entry.route.startsWith('/')) {
        errors.push(`Canonical entry "${entry.analyticsId}" route must start with "/"`);
      }
      if (entry.analyticsKind === 'domain' || entry.analyticsKind === 'hub') {
        const priorRoute = seenRoutes.get(entry.route);
        if (priorRoute) {
          errors.push(`Duplicate route "${entry.route}" (${priorRoute} and ${owner})`);
        } else {
          seenRoutes.set(entry.route, owner);
        }
      }
    }

    const action = entry.permissionAction;
    if (!action || !VALID_ACTIONS.has(action)) {
      errors.push(`Canonical entry "${entry.analyticsId}" has invalid permissionAction "${String(action)}"`);
    }

    const resource = 'permissionResource' in entry ? entry.permissionResource : undefined;
    if (!resource?.startsWith('api.')) {
      errors.push(`Canonical entry "${entry.analyticsId}" permissionResource must start with "api."`);
    }

    if (entry.featureId && !VALID_FEATURE_IDS.has(entry.featureId)) {
      errors.push(`Canonical entry "${entry.analyticsId}" has invalid featureId "${entry.featureId}"`);
    }
  }

  return errors;
}
