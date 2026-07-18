import type { LicensedModuleId } from '../types';

export type CanonicalReportCategoryId =
  | 'executive'
  | 'patients'
  | 'appointments'
  | 'scheduling'
  | 'queue'
  | 'emr'
  | 'dental'
  | 'beauty'
  | 'inventory'
  | 'billing'
  | 'revenue'
  | 'finance'
  | 'commission'
  | 'subscriptions'
  | 'staff'
  | 'operations'
  | 'audit'
  | 'notifications'
  | 'platform'
  | 'system'
  | 'custom';

export type CanonicalReportDelivery = 'view' | 'generate' | 'export';

export type CanonicalReportPermissionAction = 'view' | 'create' | 'export';

export type CanonicalReportExportFormat = 'pdf' | 'csv' | 'xlsx';

export type CanonicalAnalyticsFormat = 'pdf' | 'excel' | 'csv' | 'json';

/** Minimal, validated feature ID set for report catalog entries. */
export const CANONICAL_REPORT_FEATURE_IDS = ['reports', 'analytics'] as const;
export type CanonicalReportFeatureId = (typeof CANONICAL_REPORT_FEATURE_IDS)[number];

export interface CanonicalReportCategory {
  categoryId: CanonicalReportCategoryId;
  categoryKey: string;
  labelKey: string;
  icon?: string;
  sortOrder: number;
}

export interface CanonicalReportTemplate {
  reportId: string;
  moduleId: LicensedModuleId;
  categoryId: CanonicalReportCategoryId;
  categoryKey: string;
  dataDomain: string;

  titleKey: string;
  descriptionKey: string;
  icon?: string;
  featured?: boolean;
  tags?: string[];
  sortOrder: number;

  delivery: CanonicalReportDelivery;
  route?: string;
  deepLinkTemplate: string;

  permissionAction: CanonicalReportPermissionAction;
  permissionResource: string;
  permissionResources?: string[];
  featureId?: CanonicalReportFeatureId;

  // Backend binding (metadata only)
  analyticsType?: string;
  operationalType?: string;

  defaultFormat?: CanonicalAnalyticsFormat;
  supportedFormats?: CanonicalAnalyticsFormat[];
  exportFormats?: CanonicalReportExportFormat[];

  scheduleAllowed?: boolean;
  providerKey: string;
}

export type CanonicalReportHub = CanonicalReportTemplate;

