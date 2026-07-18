import type { AnalyticsDomain, AnalyticsDomainId } from '@/features/analytics/config/analytics-catalog';
import type {
  AnalyticsDomainSnapshot,
  AnalyticsSnapshot,
  AnalyticsWidgetSnapshot,
} from './analytics-types';

const ICON_KEYS = new Set<AnalyticsDomain['icon']>([
  'layout',
  'revenue',
  'patients',
  'calendar',
  'inventory',
  'clinical',
  'dental',
  'beauty',
  'staff',
  'branches',
  'forecast',
]);

function toDomainIcon(iconKey: string): AnalyticsDomain['icon'] {
  if (ICON_KEYS.has(iconKey as AnalyticsDomain['icon'])) {
    return iconKey as AnalyticsDomain['icon'];
  }
  return 'layout';
}

export function snapshotDomainToAnalyticsDomain(domain: AnalyticsDomainSnapshot): AnalyticsDomain {
  return {
    id: domain.domainId,
    route: domain.route,
    titleKey: domain.titleKey,
    descriptionKey: domain.descriptionKey,
    icon: toDomainIcon(domain.iconKey),
  };
}

export function snapshotDomainsToAnalyticsDomains(snapshot: AnalyticsSnapshot): AnalyticsDomain[] {
  return snapshot.domains.map(snapshotDomainToAnalyticsDomain);
}

export function findAnalyticsDomainInSnapshot(
  snapshot: AnalyticsSnapshot,
  domainId: string,
): AnalyticsDomain | undefined {
  const domain = snapshot.domains.find((entry) => entry.domainId === domainId);
  return domain ? snapshotDomainToAnalyticsDomain(domain) : undefined;
}

export interface AnalyticsWidgetCatalogItem {
  id: string;
  metricName: string;
  chartType: AnalyticsWidgetSnapshot['chartType'];
  size: AnalyticsWidgetSnapshot['size'];
  titleKey: string;
  descriptionKey: string;
}

export function snapshotWidgetToCatalogItem(widget: AnalyticsWidgetSnapshot): AnalyticsWidgetCatalogItem {
  return {
    id: widget.widgetCatalogId,
    metricName: widget.primaryMetricId,
    chartType: widget.chartType,
    size: widget.size,
    titleKey: widget.titleKey,
    descriptionKey: widget.descriptionKey,
  };
}

export function snapshotWidgetsToCatalogItems(snapshot: AnalyticsSnapshot): AnalyticsWidgetCatalogItem[] {
  return snapshot.widgets.map(snapshotWidgetToCatalogItem);
}

export function findWidgetInSnapshot(
  snapshot: AnalyticsSnapshot,
  widgetCatalogId: string,
): AnalyticsWidgetCatalogItem | undefined {
  const widget = snapshot.widgets.find((entry) => entry.widgetCatalogId === widgetCatalogId);
  return widget ? snapshotWidgetToCatalogItem(widget) : undefined;
}

export function isDomainVisibleInSnapshot(
  snapshot: AnalyticsSnapshot,
  domainId: AnalyticsDomainId,
): boolean {
  return snapshot.domains.some((domain) => domain.domainId === domainId);
}
