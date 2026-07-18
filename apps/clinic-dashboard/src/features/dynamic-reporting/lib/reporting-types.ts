import type { GenerateAnalyticsReportInput } from '@/features/analytics/api/analytics-api';
import type { ReportCategoryId } from '@/features/reporting/config/reporting-catalog';
import type { LicensedModuleId } from '@booking/module-registry';

export type ReportCatalogSource = 'registry' | 'static-fallback' | 'static-only';

export type ReportDeliveryMode = 'view' | 'generate' | 'export';

export type ReportPermissionAction = 'view' | 'create' | 'export';

export type ReportCatalogEntryKind = 'template' | 'hub';

export interface ReportCatalogEntry {
  extensionId: string;
  moduleId: LicensedModuleId;
  localId: string;
  reportId: string;
  categoryKey: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  delivery: ReportDeliveryMode;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: ReportPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  analyticsType?: string;
  operationalType?: string;
  defaultFormat?: string;
  supportedFormats?: string[];
  exportFormats?: string[];
  scheduleAllowed?: boolean;
  providerKey: string;
  sortOrder: number;
  icon?: string;
  featured?: boolean;
  tags?: string[];
}

export interface ReportSnapshotIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
}

export interface ReportTemplateSnapshot {
  kind: 'template';
  extensionId: string;
  moduleId: LicensedModuleId;
  reportId: string;
  categoryId: ReportCategoryId;
  categoryKey: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  delivery: ReportDeliveryMode;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: ReportPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  analyticsType?: GenerateAnalyticsReportInput['reportType'];
  operationalType?: string;
  defaultFormat?: GenerateAnalyticsReportInput['format'];
  supportedFormats?: GenerateAnalyticsReportInput['format'][];
  exportFormats?: string[];
  scheduleAllowed?: boolean;
  providerKey: string;
  sortOrder: number;
  icon?: string;
  featured?: boolean;
  tags?: string[];
}

export interface ReportHubSnapshot {
  kind: 'hub';
  extensionId: string;
  moduleId: LicensedModuleId;
  reportId: string;
  categoryKey: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  delivery: ReportDeliveryMode;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: ReportPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  providerKey: string;
  sortOrder: number;
}

export interface ReportCategorySnapshot {
  categoryId: ReportCategoryId;
  labelKey: string;
  templateCount: number;
}

export interface ReportSnapshot {
  source: ReportCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: ReportSnapshotIdentity;
  categories: ReportCategorySnapshot[];
  templates: ReportTemplateSnapshot[];
  hubEntries: ReportHubSnapshot[];
  templatesByCategory: Partial<Record<ReportCategoryId, ReportTemplateSnapshot[]>>;
  featuredTemplates: ReportTemplateSnapshot[];
  enabledModuleIds: string[];
  deepLinkByReportId: Record<string, string>;
  labelKeyByReportId: Record<string, string>;
  providerKeyByReportId: Record<string, string>;
  canViewReporting: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
}

export interface ReportingContributionView {
  extensionId: string;
  moduleId: LicensedModuleId;
  reportId: string;
  categoryKey: string;
  dataDomain: string;
  labelKey: string;
  delivery: ReportDeliveryMode;
  route?: string;
  deepLinkTemplate: string;
  permissionAction: ReportPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: string;
  analyticsType?: string;
  operationalType?: string;
  providerKey: string;
  sortOrder: number;
  userVisible: boolean;
  userAccessible: boolean;
}

export interface ReportingCacheIdentity {
  tenantId: string;
  userId: string;
  rolesHash: string;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  moduleCount: number;
  source: ReportCatalogSource;
  /** Phase 36b — synchronized with DynamicBranchProvider publication. */
  branchSnapshotVersion?: string | null;
}

export interface ReportingCapabilities {
  canViewReporting: boolean;
  canCreateReports: boolean;
  canExportReports: boolean;
}
