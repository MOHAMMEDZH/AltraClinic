import type { AnalyticsDomainId } from '@/features/analytics/config/analytics-catalog';
import type { LicensedModuleId } from '@booking/module-registry';

export type AnalyticsCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export type AnalyticsKind = 'domain' | 'widget' | 'hub';

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
  | 'funnel';

export interface AnalyticsCatalogEntry {
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  analyticsId: string;
  analyticsKind: AnalyticsKind;
  categoryId: string;
  dataDomain: string;
  labelKey: string;
  descriptionKey?: string;
  iconKey?: string;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
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
  chartType?: VisualizationType;
  size?: 'small' | 'medium' | 'large';
}

export interface AnalyticsSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
}

export interface AnalyticsDomainSnapshot {
  kind: 'domain';
  extensionId: string;
  moduleId: LicensedModuleId;
  domainId: AnalyticsDomainId;
  analyticsId: string;
  categoryId: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  iconKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  metricIds: string[];
  reportLinkIds: string[];
  dashboardWidgetIds: string[];
  filterProfile?: string;
  providerKey: string;
  classification: string;
  sortOrder: number;
}

export interface AnalyticsWidgetSnapshot {
  kind: 'widget';
  extensionId: string;
  moduleId: LicensedModuleId;
  widgetCatalogId: string;
  analyticsId: string;
  categoryId: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  primaryMetricId: string;
  metricIds: string[];
  chartType: VisualizationType;
  size: 'small' | 'medium' | 'large';
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  featureId?: string;
  providerKey: string;
  classification: string;
  sortOrder: number;
}

export interface AnalyticsHubSnapshot {
  kind: 'hub';
  extensionId: string;
  moduleId: LicensedModuleId;
  hubId: string;
  analyticsId: string;
  categoryId: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  route: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  exportFormats?: string[];
  providerKey: string;
  sortOrder: number;
}

export interface AnalyticsCategorySnapshot {
  categoryId: string;
  labelKey: string;
  domainCount: number;
}

export interface AnalyticsMetricDefinitionSnapshot {
  metricId: string;
  labelKey: string;
  descriptionKey: string;
  unit: string;
  format: string;
  categoryId: string;
  dataDomain: string;
  providerKey: string;
}

export interface AnalyticsSnapshotEntry {
  analyticsId: string;
  extensionId: string;
  moduleId: LicensedModuleId;
  analyticsKind: AnalyticsKind;
  labelKey: string;
  route?: string;
  deepLinkTemplate: string;
  metricIds: string[];
  reportLinkIds: string[];
  dashboardWidgetIds: string[];
  classification: string;
  sortOrder: number;
  permissionAction: AnalyticsPermissionAction;
}

export interface AnalyticsCapabilities {
  canViewAnalytics: boolean;
  canCreateDashboards: boolean;
  canExportAnalytics: boolean;
  canScheduleAnalytics: boolean;
}

export interface AnalyticsSnapshot {
  source: AnalyticsCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: AnalyticsSnapshotIdentity;
  generatedAt: string;
  entries: AnalyticsSnapshotEntry[];
  domains: AnalyticsDomainSnapshot[];
  widgets: AnalyticsWidgetSnapshot[];
  hubs: AnalyticsHubSnapshot[];
  categories: AnalyticsCategorySnapshot[];
  metrics: AnalyticsMetricDefinitionSnapshot[];
  capabilities: AnalyticsCapabilities;
  enabledModuleIds: string[];
  providerKeys: string[];
  deepLinkByAnalyticsId: Record<string, string>;
  labelKeyByAnalyticsId: Record<string, string>;
  canViewAnalytics: boolean;
  canCreateDashboards: boolean;
  canExportAnalytics: boolean;
  canScheduleAnalytics: boolean;
}

export interface AnalyticsContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  analyticsId: string;
  analyticsKind: AnalyticsKind;
  localId: string;
  categoryId: string;
  dataDomain: string;
  labelKey: string;
  descriptionKey?: string;
  iconKey?: string;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: AnalyticsPermissionAction;
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
  chartType?: VisualizationType;
  size?: 'small' | 'medium' | 'large';
  providerKey: string;
  classification: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface AnalyticsCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  source: AnalyticsCatalogSource;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}
