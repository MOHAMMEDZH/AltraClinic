import type { GenerateAnalyticsReportInput } from '@/features/analytics/api/analytics-api';

export type ReportCategoryId =
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

export type ReportDeliveryMode = 'view' | 'generate' | 'export';

export interface ReportPermission {
  resource: string;
  action: string;
}

export interface ReportTemplate {
  id: string;
  categoryId: ReportCategoryId;
  titleKey: string;
  descriptionKey: string;
  delivery: ReportDeliveryMode;
  /** In-app route for live dashboards */
  route?: string;
  /** Server-side analytics report type */
  analyticsType?: GenerateAnalyticsReportInput['reportType'];
  defaultFormat?: GenerateAnalyticsReportInput['format'];
  supportedFormats?: GenerateAnalyticsReportInput['format'][];
  permission: ReportPermission;
  featured?: boolean;
  tags?: string[];
}

export const REPORT_CATEGORIES: ReportCategoryId[] = [
  'executive',
  'patients',
  'appointments',
  'scheduling',
  'queue',
  'emr',
  'dental',
  'beauty',
  'inventory',
  'billing',
  'revenue',
  'finance',
  'commission',
  'subscriptions',
  'staff',
  'operations',
  'audit',
  'notifications',
  'platform',
  'system',
  'custom',
];

export const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: 'executive-dashboard',
    categoryId: 'executive',
    titleKey: 'reports.templates.executiveDashboard.title',
    descriptionKey: 'reports.templates.executiveDashboard.desc',
    delivery: 'view',
    route: '/analytics?metric=all',
    permission: { resource: 'api.analytics', action: 'view' },
    featured: true,
    tags: ['kpi', 'overview'],
  },
  {
    id: 'executive-export',
    categoryId: 'executive',
    titleKey: 'reports.templates.executiveSummary.title',
    descriptionKey: 'reports.templates.executiveSummary.desc',
    delivery: 'generate',
    analyticsType: 'executive',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv', 'json'],
    permission: { resource: 'api.analytics', action: 'create' },
    featured: true,
  },
  {
    id: 'patient-growth',
    categoryId: 'patients',
    titleKey: 'reports.templates.patientGrowth.title',
    descriptionKey: 'reports.templates.patientGrowth.desc',
    delivery: 'view',
    route: '/analytics?metric=patients',
    permission: { resource: 'api.analytics', action: 'view' },
    featured: true,
  },
  {
    id: 'patient-list-export',
    categoryId: 'patients',
    titleKey: 'reports.templates.patientStatistics.title',
    descriptionKey: 'reports.templates.patientStatistics.desc',
    delivery: 'generate',
    analyticsType: 'clinical',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'appointment-summary',
    categoryId: 'appointments',
    titleKey: 'reports.templates.appointmentSummary.title',
    descriptionKey: 'reports.templates.appointmentSummary.desc',
    delivery: 'view',
    route: '/analytics?metric=appointments',
    permission: { resource: 'api.analytics', action: 'view' },
    featured: true,
  },
  {
    id: 'scheduling-analytics',
    categoryId: 'scheduling',
    titleKey: 'reports.templates.schedulingPerformance.title',
    descriptionKey: 'reports.templates.schedulingPerformance.desc',
    delivery: 'view',
    route: '/appointments',
    permission: { resource: 'api.scheduling', action: 'view' },
  },
  {
    id: 'queue-performance',
    categoryId: 'queue',
    titleKey: 'reports.templates.queuePerformance.title',
    descriptionKey: 'reports.templates.queuePerformance.desc',
    delivery: 'view',
    route: '/queue/analytics',
    permission: { resource: 'api.queue', action: 'view' },
    featured: true,
  },
  {
    id: 'clinical-activity',
    categoryId: 'emr',
    titleKey: 'reports.templates.clinicalActivity.title',
    descriptionKey: 'reports.templates.clinicalActivity.desc',
    delivery: 'generate',
    analyticsType: 'clinical',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'dental-treatment-plans',
    categoryId: 'dental',
    titleKey: 'reports.templates.dentalProcedures.title',
    descriptionKey: 'reports.templates.dentalProcedures.desc',
    delivery: 'view',
    route: '/dental/treatment-plans',
    permission: { resource: 'api.dental', action: 'view' },
  },
  {
    id: 'beauty-sessions',
    categoryId: 'beauty',
    titleKey: 'reports.templates.beautySessions.title',
    descriptionKey: 'reports.templates.beautySessions.desc',
    delivery: 'view',
    route: '/beauty',
    permission: { resource: 'api.beauty', action: 'view' },
  },
  {
    id: 'inventory-status',
    categoryId: 'inventory',
    titleKey: 'reports.templates.inventoryStatus.title',
    descriptionKey: 'reports.templates.inventoryStatus.desc',
    delivery: 'view',
    route: '/inventory/reports',
    permission: { resource: 'api.inventory', action: 'view' },
    featured: true,
  },
  {
    id: 'inventory-analytics-export',
    categoryId: 'inventory',
    titleKey: 'reports.templates.inventoryConsumption.title',
    descriptionKey: 'reports.templates.inventoryConsumption.desc',
    delivery: 'export',
    route: '/inventory/reports',
    permission: { resource: 'api.inventory', action: 'export' },
  },
  {
    id: 'billing-summary',
    categoryId: 'billing',
    titleKey: 'reports.templates.billingSummary.title',
    descriptionKey: 'reports.templates.billingSummary.desc',
    delivery: 'view',
    route: '/billing/reports',
    permission: { resource: 'api.billing', action: 'view' },
    featured: true,
  },
  {
    id: 'outstanding-invoices',
    categoryId: 'finance',
    titleKey: 'reports.templates.outstandingInvoices.title',
    descriptionKey: 'reports.templates.outstandingInvoices.desc',
    delivery: 'view',
    route: '/billing/outstanding',
    permission: { resource: 'api.billing', action: 'view' },
    featured: true,
  },
  {
    id: 'revenue-summary',
    categoryId: 'revenue',
    titleKey: 'reports.templates.revenueSummary.title',
    descriptionKey: 'reports.templates.revenueSummary.desc',
    delivery: 'view',
    route: '/analytics?metric=revenue',
    permission: { resource: 'api.analytics', action: 'view' },
    featured: true,
  },
  {
    id: 'financial-export',
    categoryId: 'finance',
    titleKey: 'reports.templates.financialSummary.title',
    descriptionKey: 'reports.templates.financialSummary.desc',
    delivery: 'generate',
    analyticsType: 'financial',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv', 'json'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'commission-summary',
    categoryId: 'commission',
    titleKey: 'reports.templates.commissionSummary.title',
    descriptionKey: 'reports.templates.commissionSummary.desc',
    delivery: 'view',
    route: '/billing/commissions',
    permission: { resource: 'api.commission', action: 'view' },
  },
  {
    id: 'operational-export',
    categoryId: 'operations',
    titleKey: 'reports.templates.operationsSummary.title',
    descriptionKey: 'reports.templates.operationsSummary.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'custom-report',
    categoryId: 'custom',
    titleKey: 'reports.templates.customReport.title',
    descriptionKey: 'reports.templates.customReport.desc',
    delivery: 'generate',
    analyticsType: 'custom',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv', 'json'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'doctor-productivity',
    categoryId: 'staff',
    titleKey: 'reports.templates.doctorProductivity.title',
    descriptionKey: 'reports.templates.doctorProductivity.desc',
    delivery: 'view',
    route: '/analytics?metric=appointments',
    permission: { resource: 'api.analytics', action: 'view' },
    tags: ['doctor', 'productivity'],
  },
  {
    id: 'department-performance',
    categoryId: 'staff',
    titleKey: 'reports.templates.departmentPerformance.title',
    descriptionKey: 'reports.templates.departmentPerformance.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'branch-performance',
    categoryId: 'operations',
    titleKey: 'reports.templates.branchPerformance.title',
    descriptionKey: 'reports.templates.branchPerformance.desc',
    delivery: 'view',
    route: '/',
    permission: { resource: 'api.analytics', action: 'view' },
    tags: ['branch'],
  },
  {
    id: 'low-stock',
    categoryId: 'inventory',
    titleKey: 'reports.templates.lowStock.title',
    descriptionKey: 'reports.templates.lowStock.desc',
    delivery: 'view',
    route: '/inventory/catalog?stock=low',
    permission: { resource: 'api.inventory', action: 'view' },
  },
  {
    id: 'expiring-products',
    categoryId: 'inventory',
    titleKey: 'reports.templates.expiringProducts.title',
    descriptionKey: 'reports.templates.expiringProducts.desc',
    delivery: 'view',
    route: '/inventory/expiry',
    permission: { resource: 'api.inventory', action: 'view' },
  },
  {
    id: 'supplier-performance',
    categoryId: 'inventory',
    titleKey: 'reports.templates.supplierPerformance.title',
    descriptionKey: 'reports.templates.supplierPerformance.desc',
    delivery: 'view',
    route: '/inventory/suppliers',
    permission: { resource: 'api.inventory', action: 'view' },
  },
  {
    id: 'cash-flow',
    categoryId: 'finance',
    titleKey: 'reports.templates.cashFlow.title',
    descriptionKey: 'reports.templates.cashFlow.desc',
    delivery: 'view',
    route: '/billing/cashbox',
    permission: { resource: 'api.billing', action: 'view' },
  },
  {
    id: 'payment-collection',
    categoryId: 'billing',
    titleKey: 'reports.templates.paymentCollection.title',
    descriptionKey: 'reports.templates.paymentCollection.desc',
    delivery: 'view',
    route: '/billing',
    permission: { resource: 'api.billing', action: 'view' },
  },
  {
    id: 'subscription-overview',
    categoryId: 'subscriptions',
    titleKey: 'reports.templates.subscriptionOverview.title',
    descriptionKey: 'reports.templates.subscriptionOverview.desc',
    delivery: 'generate',
    analyticsType: 'financial',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'treatment-plans',
    categoryId: 'dental',
    titleKey: 'reports.templates.treatmentPlans.title',
    descriptionKey: 'reports.templates.treatmentPlans.desc',
    delivery: 'view',
    route: '/dental',
    permission: { resource: 'api.dental', action: 'view' },
  },
  {
    id: 'security-audit',
    categoryId: 'audit',
    titleKey: 'reports.templates.securityAudit.title',
    descriptionKey: 'reports.templates.securityAudit.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'csv'],
    permission: { resource: 'api.reporting', action: 'create' },
  },
  {
    id: 'user-activity',
    categoryId: 'audit',
    titleKey: 'reports.templates.userActivity.title',
    descriptionKey: 'reports.templates.userActivity.desc',
    delivery: 'view',
    route: '/settings/security/sessions',
    permission: { resource: 'api.auth', action: 'view' },
  },
  {
    id: 'appointment-export',
    categoryId: 'appointments',
    titleKey: 'reports.templates.appointmentExport.title',
    descriptionKey: 'reports.templates.appointmentExport.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.reporting', action: 'create' },
  },
  {
    id: 'patient-export',
    categoryId: 'patients',
    titleKey: 'reports.templates.patientExport.title',
    descriptionKey: 'reports.templates.patientExport.desc',
    delivery: 'generate',
    analyticsType: 'clinical',
    defaultFormat: 'csv',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.reporting', action: 'create' },
  },
  {
    id: 'revenue-export',
    categoryId: 'revenue',
    titleKey: 'reports.templates.revenueExport.title',
    descriptionKey: 'reports.templates.revenueExport.desc',
    delivery: 'generate',
    analyticsType: 'financial',
    defaultFormat: 'excel',
    supportedFormats: ['pdf', 'excel', 'csv', 'json'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'notification-delivery',
    categoryId: 'notifications',
    titleKey: 'reports.templates.notificationDelivery.title',
    descriptionKey: 'reports.templates.notificationDelivery.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'csv',
    supportedFormats: ['csv', 'excel', 'pdf'],
    permission: { resource: 'api.reporting', action: 'create' },
  },
  {
    id: 'notification-failures',
    categoryId: 'notifications',
    titleKey: 'reports.templates.notificationFailures.title',
    descriptionKey: 'reports.templates.notificationFailures.desc',
    delivery: 'view',
    route: '/settings/notifications/delivery',
    permission: { resource: 'api.notifications', action: 'view' },
  },
  {
    id: 'platform-tenants',
    categoryId: 'platform',
    titleKey: 'reports.templates.platformTenants.title',
    descriptionKey: 'reports.templates.platformTenants.desc',
    delivery: 'view',
    route: '/platform-admin',
    permission: { resource: 'api.platform-admin', action: 'view' },
  },
  {
    id: 'platform-usage',
    categoryId: 'platform',
    titleKey: 'reports.templates.platformUsage.title',
    descriptionKey: 'reports.templates.platformUsage.desc',
    delivery: 'generate',
    analyticsType: 'executive',
    defaultFormat: 'pdf',
    supportedFormats: ['pdf', 'excel', 'csv'],
    permission: { resource: 'api.platform-admin', action: 'view' },
  },
  {
    id: 'system-usage',
    categoryId: 'system',
    titleKey: 'reports.templates.systemUsage.title',
    descriptionKey: 'reports.templates.systemUsage.desc',
    delivery: 'generate',
    analyticsType: 'operational',
    defaultFormat: 'csv',
    supportedFormats: ['csv', 'json'],
    permission: { resource: 'api.analytics', action: 'create' },
  },
  {
    id: 'api-audit-log',
    categoryId: 'system',
    titleKey: 'reports.templates.apiAuditLog.title',
    descriptionKey: 'reports.templates.apiAuditLog.desc',
    delivery: 'view',
    route: '/settings/audit',
    permission: { resource: 'api.audit', action: 'view' },
  },
];

export function templatesForCategory(categoryId: ReportCategoryId | 'all'): ReportTemplate[] {
  if (categoryId === 'all') return REPORT_TEMPLATES;
  return REPORT_TEMPLATES.filter((t) => t.categoryId === categoryId);
}

export function findTemplate(templateId: string): ReportTemplate | undefined {
  return REPORT_TEMPLATES.find((t) => t.id === templateId);
}
