import {
  CANONICAL_ANALYTICS_DOMAINS,
} from './canonical-analytics-domains';
import { CANONICAL_ANALYTICS_HUBS } from './canonical-analytics-hubs';
import { CANONICAL_ANALYTICS_WIDGETS } from './canonical-analytics-widgets';
import { CANONICAL_CROSS_MODULE_ANALYTICS } from './canonical-cross-module-analytics';
import type { CanonicalAnalyticsEntry } from './analytics-types';

/** Minimal static catalog entry shape for parity validation (Phase 34a). */
export interface StaticAnalyticsCatalogEntryLike {
  extensionId: string;
  moduleId: string;
  localId: string;
  analyticsId: string;
  analyticsKind: 'domain' | 'widget' | 'hub';
  categoryId: string;
  dataDomain: string;
  labelKey: string;
  descriptionKey?: string;
  iconKey?: string;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: 'view' | 'create' | 'export';
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  metricIds?: string[];
  primaryMetricId?: string;
  widgetCatalogId?: string;
  reportLinkIds?: string[];
  dashboardWidgetIds?: string[];
  exportFormats?: string[];
  filterProfile?: string;
  providerKey: string;
  classification: string;
  sortOrder: number;
  schemaVersion: 1;
}

const CANONICAL_ENTRIES: CanonicalAnalyticsEntry[] = [
  ...CANONICAL_ANALYTICS_DOMAINS,
  ...CANONICAL_ANALYTICS_WIDGETS,
  ...CANONICAL_ANALYTICS_HUBS,
  ...CANONICAL_CROSS_MODULE_ANALYTICS,
];

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_ENTRIES.map((entry) => [`${entry.moduleId}/analytics/${entry.localId}`, entry]),
);

function compareOptionalField(
  errors: string[],
  analyticsId: string,
  field: string,
  actual: unknown,
  expected: unknown,
): void {
  if ((actual ?? null) !== (expected ?? null)) {
    errors.push(
      `Static catalog "${analyticsId}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

function compareStringArrayField(
  errors: string[],
  analyticsId: string,
  field: string,
  actual: string[] | undefined,
  expected: string[] | undefined,
): void {
  const a = actual ?? [];
  const e = expected ?? [];
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    errors.push(`Static catalog "${analyticsId}" ${field} mismatch: static=[${a.join(',')}] canonical=[${e.join(',')}]`);
  }
}

/** Fail-closed field-by-field parity between STATIC_ANALYTICS_CATALOG and canonical vocabulary. */
export function validateStaticAnalyticsCatalogParity(entries: StaticAnalyticsCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();
  const seenAnalyticsIds = new Set<string>();

  if (entries.length !== CANONICAL_ENTRIES.length) {
    errors.push(`Static catalog count mismatch: static=${entries.length} canonical=${CANONICAL_ENTRIES.length}`);
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static catalog extensionId "${entry.extensionId}"`);
    } else {
      seenExtensionIds.add(entry.extensionId);
    }

    if (seenAnalyticsIds.has(entry.analyticsId)) {
      errors.push(`Duplicate static catalog analyticsId "${entry.analyticsId}"`);
    } else {
      seenAnalyticsIds.add(entry.analyticsId);
    }

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static catalog entry "${entry.extensionId}"`);
      continue;
    }

    compareOptionalField(errors, entry.analyticsId, 'moduleId', entry.moduleId, canonical.moduleId);
    compareOptionalField(errors, entry.analyticsId, 'localId', entry.localId, canonical.localId);
    compareOptionalField(errors, entry.analyticsId, 'analyticsId', entry.analyticsId, canonical.analyticsId);
    compareOptionalField(errors, entry.analyticsId, 'analyticsKind', entry.analyticsKind, canonical.analyticsKind);
    compareOptionalField(errors, entry.analyticsId, 'categoryId', entry.categoryId, canonical.categoryId);
    compareOptionalField(errors, entry.analyticsId, 'dataDomain', entry.dataDomain, canonical.dataDomain);
    compareOptionalField(errors, entry.analyticsId, 'classification', entry.classification, canonical.classification);
    compareOptionalField(errors, entry.analyticsId, 'permissionAction', entry.permissionAction, canonical.permissionAction);
    compareOptionalField(errors, entry.analyticsId, 'permissionResource', entry.permissionResource, canonical.permissionResource);
    compareOptionalField(errors, entry.analyticsId, 'providerKey', entry.providerKey, canonical.providerKey);
    compareOptionalField(errors, entry.analyticsId, 'sortOrder', entry.sortOrder, canonical.sortOrder);
    compareOptionalField(errors, entry.analyticsId, 'featureId', entry.featureId, canonical.featureId);

    const canonicalDeepLink =
      canonical.analyticsKind === 'widget'
        ? `/analytics/builder?widget=${canonical.widgetCatalogId}`
        : canonical.deepLinkTemplate;
    compareOptionalField(errors, entry.analyticsId, 'deepLinkTemplate', entry.deepLinkTemplate, canonicalDeepLink);

    if (canonical.analyticsKind === 'domain') {
      compareOptionalField(errors, entry.analyticsId, 'route', entry.route, canonical.route);
      compareOptionalField(errors, entry.analyticsId, 'iconKey', entry.iconKey, canonical.iconKey);
      compareOptionalField(errors, entry.analyticsId, 'filterProfile', entry.filterProfile, canonical.filterProfile);
      compareStringArrayField(errors, entry.analyticsId, 'metricIds', entry.metricIds, canonical.metricIds);
      compareStringArrayField(errors, entry.analyticsId, 'reportLinkIds', entry.reportLinkIds, canonical.reportLinkIds);
      compareStringArrayField(
        errors,
        entry.analyticsId,
        'dashboardWidgetIds',
        entry.dashboardWidgetIds,
        canonical.dashboardWidgetIds,
      );
    }

    if (canonical.analyticsKind === 'widget') {
      compareOptionalField(errors, entry.analyticsId, 'widgetCatalogId', entry.widgetCatalogId, canonical.widgetCatalogId);
      compareOptionalField(errors, entry.analyticsId, 'primaryMetricId', entry.primaryMetricId, canonical.primaryMetricId);
      compareStringArrayField(errors, entry.analyticsId, 'metricIds', entry.metricIds, canonical.metricIds);
    }

    if (canonical.analyticsKind === 'hub') {
      compareOptionalField(errors, entry.analyticsId, 'route', entry.route, canonical.route);
      compareStringArrayField(
        errors,
        entry.analyticsId,
        'exportFormats',
        entry.exportFormats,
        canonical.exportFormats?.map(String),
      );
    }
  }

  for (const canonical of CANONICAL_ENTRIES) {
    const extensionId = `${canonical.moduleId}/analytics/${canonical.localId}`;
    if (!entries.some((entry) => entry.extensionId === extensionId)) {
      errors.push(`Missing static catalog entry for canonical "${extensionId}"`);
    }
  }

  return errors;
}
