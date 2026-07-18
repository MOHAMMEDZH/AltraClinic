import type { LicensedModuleId } from '../types';

export const ANALYTICS_CONTRIBUTION_SCHEMA_VERSION = 1 as const;

export type AnalyticsKind = 'domain' | 'widget' | 'hub' | 'kpi' | 'alert' | 'savedView';

export type AnalyticsDataDomain =
  | 'executive'
  | 'financial'
  | 'patients'
  | 'operations'
  | 'inventory'
  | 'clinical'
  | 'dental'
  | 'beauty'
  | 'staff'
  | 'branches'
  | 'forecasting'
  | 'platform';

export type AnalyticsCategoryId = AnalyticsDataDomain | 'platform.analytics' | 'platform.builder' | 'platform.export';

export type AnalyticsClassification = 'clinical' | 'operational' | 'financial' | 'platform';

export type AnalyticsPermissionAction = 'view' | 'create' | 'export';

export type VisualizationType =
  | 'bar'
  | 'line'
  | 'area'
  | 'pie'
  | 'donut'
  | 'gauge'
  | 'heatmap'
  | 'stackedBar'
  | 'scatter'
  | 'funnel'
  | 'table'
  | 'kpiCard';

export type AggregationMethod =
  | 'sum'
  | 'avg'
  | 'count'
  | 'min'
  | 'max'
  | 'median'
  | 'rate'
  | 'distinctCount'
  | 'percentile';

export type AnalyticsUnit = 'currency' | 'count' | 'percent' | 'minutes' | 'hours' | 'days' | 'ratio' | 'score';

export type AnalyticsKpiFormat = 'currency' | 'number' | 'percent' | 'text' | 'duration';

export type TimeGrain = 'hour' | 'day' | 'week' | 'month' | 'quarter' | 'year';

export type AnalyticsExportFormat = 'pdf' | 'csv' | 'excel' | 'json' | 'xlsx';

export const CANONICAL_ANALYTICS_FEATURE_IDS = ['analytics'] as const;
export type CanonicalAnalyticsFeatureId = (typeof CANONICAL_ANALYTICS_FEATURE_IDS)[number];

export type MetricScope = 'widget' | 'domain-kpi' | 'cross-module' | 'recorded';

/** Fully self-describing canonical metric — SSOT for all metric metadata (Phase 34a M1). */
export interface CanonicalAnalyticsMetric {
  metricId: string;
  labelKey: string;
  descriptionKey: string;
  unit: AnalyticsUnit;
  format: AnalyticsKpiFormat;
  precision: number;
  scope: MetricScope;
  categoryId: AnalyticsCategoryId;
  dataDomain: AnalyticsDataDomain;
  aggregation: AggregationMethod;
  providerKey: string;
  featureId: CanonicalAnalyticsFeatureId;
  sensitivity?: 'public' | 'internal' | 'clinical' | 'financial' | 'restricted';
}

/** Aggregate capabilities projected from AnalyticsSnapshot in Phase 34b — never UI-recomputed. */
export const ANALYTICS_AGGREGATE_CAPABILITY_IDS = [
  'canViewAnalytics',
  'canCreateDashboards',
  'canExportAnalytics',
  'canScheduleAnalytics',
] as const;

export type AnalyticsAggregateCapabilityId = (typeof ANALYTICS_AGGREGATE_CAPABILITY_IDS)[number];

export interface AnalyticsAggregateCapabilityContractEntry {
  capabilityId: AnalyticsAggregateCapabilityId;
  /** Capabilities are derived exclusively from the resolved snapshot in Phase 34b. */
  derivedFrom: 'snapshot';
  /** Vocabulary signals used by the 34b provider — not evaluated at runtime in 34a. */
  requiredSnapshotSignals: readonly string[];
  forbiddenClientDuplication: true;
}

export interface CanonicalAnalyticsDomain {
  domainId: string;
  analyticsId: string;
  localId: string;
  moduleId: LicensedModuleId;
  analyticsKind: 'domain';
  categoryId: AnalyticsCategoryId;
  dataDomain: AnalyticsDataDomain;
  classification: AnalyticsClassification;
  titleKey: string;
  descriptionKey: string;
  iconKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId: CanonicalAnalyticsFeatureId;
  metricIds: string[];
  reportLinkIds?: string[];
  dashboardWidgetIds?: string[];
  filterProfile?: 'all' | 'revenue' | 'appointments' | 'patients' | 'health';
  sortOrder: number;
  providerKey: string;
  schemaVersion: typeof ANALYTICS_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalAnalyticsWidget {
  widgetCatalogId: string;
  analyticsId: string;
  localId: string;
  moduleId: LicensedModuleId;
  analyticsKind: 'widget';
  categoryId: AnalyticsCategoryId;
  dataDomain: AnalyticsDataDomain;
  classification: AnalyticsClassification;
  titleKey: string;
  descriptionKey: string;
  primaryMetricId: string;
  metricIds: string[];
  visualizationTypes: VisualizationType[];
  chartType: VisualizationType;
  size: 'small' | 'medium' | 'large';
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  featureId: CanonicalAnalyticsFeatureId;
  sortOrder: number;
  providerKey: string;
  schemaVersion: typeof ANALYTICS_CONTRIBUTION_SCHEMA_VERSION;
}

export interface CanonicalAnalyticsHub {
  hubId: string;
  analyticsId: string;
  localId: string;
  moduleId: LicensedModuleId;
  analyticsKind: 'hub';
  categoryId: AnalyticsCategoryId;
  dataDomain: AnalyticsDataDomain;
  classification: AnalyticsClassification;
  titleKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId: CanonicalAnalyticsFeatureId;
  exportFormats?: AnalyticsExportFormat[];
  sortOrder: number;
  providerKey: string;
  schemaVersion: typeof ANALYTICS_CONTRIBUTION_SCHEMA_VERSION;
}

export type CanonicalAnalyticsEntry = CanonicalAnalyticsDomain | CanonicalAnalyticsWidget | CanonicalAnalyticsHub;
