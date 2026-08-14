import type { RouteCatalogEntry } from './route-types';

/**
 * Authoritative static route catalog — parity baseline for Phase 30.
 * Paths and nesting match `app/router/index.tsx` exactly.
 * Access is gated at runtime via EffectiveModuleView.moduleId (no client RBAC).
 */
export const STATIC_ROUTE_CATALOG: RouteCatalogEntry[] = [
  { id: 'dashboard', index: true, moduleId: 'dashboard', componentKey: 'page.dashboard' },

  { id: 'appointments', path: 'appointments', moduleId: 'scheduling', componentKey: 'page.appointments' },
  {
    id: 'my-appointments',
    path: 'my-appointments',
    moduleId: 'patientPortal',
    componentKey: 'page.myAppointments',
  },

  { id: 'queue', path: 'queue', moduleId: 'queue', componentKey: 'page.queue' },
  { id: 'queue-history', path: 'queue/history', moduleId: 'queue', componentKey: 'page.queueHistory' },
  { id: 'queue-analytics', path: 'queue/analytics', moduleId: 'queue', componentKey: 'page.queueAnalytics' },
  {
    id: 'queue-display',
    path: 'queue/display',
    moduleId: 'queue',
    componentKey: 'page.queueDisplay',
    kioskRoute: true,
  },

  { id: 'patients', path: 'patients', moduleId: 'patients', componentKey: 'page.patients' },
  {
    id: 'patient-detail',
    path: 'patients/:patientId',
    moduleId: 'patients',
    componentKey: 'page.patientDetail',
  },

  { id: 'encounters', path: 'encounters', moduleId: 'emr', componentKey: 'page.encounters' },
  {
    id: 'encounter-detail',
    path: 'encounters/:encounterId',
    moduleId: 'emr',
    componentKey: 'page.encounterDetail',
  },

  { id: 'dental', path: 'dental', moduleId: 'dental', componentKey: 'page.dental' },
  {
    id: 'dental-chart',
    path: 'dental/chart/:patientId',
    moduleId: 'dental',
    componentKey: 'page.dentalChart',
  },
  {
    id: 'dental-plan',
    path: 'dental/chart/:patientId/plan/:planId',
    moduleId: 'dental',
    componentKey: 'page.dentalPlan',
  },
  {
    id: 'dental-imaging',
    path: 'dental/imaging/:patientId',
    moduleId: 'dental',
    componentKey: 'page.dentalImaging',
  },

  { id: 'beauty', path: 'beauty', moduleId: 'beauty', componentKey: 'page.beauty' },
  {
    id: 'beauty-workspace',
    path: 'beauty/workspace/:patientId',
    moduleId: 'beauty',
    componentKey: 'page.beautyWorkspace',
  },
  {
    id: 'beauty-present',
    path: 'beauty/present/:patientId',
    moduleId: 'beauty',
    componentKey: 'page.beautyPresentation',
  },
  {
    id: 'beauty-imaging',
    path: 'beauty/imaging/:patientId',
    moduleId: 'beauty',
    componentKey: 'page.beautyImaging',
  },

  { id: 'billing', path: 'billing', moduleId: 'billing', componentKey: 'page.billingDashboard' },
  { id: 'billing-invoices', path: 'billing/invoices', moduleId: 'billing', componentKey: 'page.billingInvoices' },
  {
    id: 'billing-invoice-new',
    path: 'billing/invoices/new',
    moduleId: 'billing',
    componentKey: 'page.billingInvoiceNew',
  },
  {
    id: 'billing-invoice-detail',
    path: 'billing/invoices/:invoiceId',
    moduleId: 'billing',
    componentKey: 'page.billingInvoiceDetail',
  },
  {
    id: 'billing-outstanding',
    path: 'billing/outstanding',
    moduleId: 'billing',
    componentKey: 'page.billingOutstanding',
  },
  { id: 'billing-unbilled', path: 'billing/unbilled', moduleId: 'billing', componentKey: 'page.billingUnbilled' },
  { id: 'billing-cashbox', path: 'billing/cashbox', moduleId: 'billing', componentKey: 'page.billingCashbox' },
  { id: 'billing-pricing', path: 'billing/pricing', moduleId: 'billing', componentKey: 'page.billingPricing' },
  {
    id: 'billing-clinical-pricing',
    path: 'billing/clinical-pricing',
    moduleId: 'billing',
    componentKey: 'page.billingClinicalPricing',
  },
  { id: 'billing-pos', path: 'billing/pos', moduleId: 'billing', componentKey: 'page.billingPos' },
  { id: 'billing-reports', path: 'billing/reports', moduleId: 'billing', componentKey: 'page.billingReports' },
  {
    id: 'billing-receipt',
    path: 'billing/receipts/:receiptNumber',
    moduleId: 'billing',
    componentKey: 'page.billingReceipt',
  },
  {
    id: 'billing-commissions',
    path: 'billing/commissions',
    moduleId: 'billing',
    componentKey: 'page.billingCommissions',
  },
  {
    id: 'billing-commission-rules',
    path: 'billing/commissions/rules',
    moduleId: 'billing',
    componentKey: 'page.billingCommissionRules',
  },

  { id: 'inventory', path: 'inventory', moduleId: 'inventory', componentKey: 'page.inventoryDashboard' },
  { id: 'inventory-catalog', path: 'inventory/catalog', moduleId: 'inventory', componentKey: 'page.inventoryCatalog' },
  { id: 'inventory-expiry', path: 'inventory/expiry', moduleId: 'inventory', componentKey: 'page.inventoryExpiry' },
  {
    id: 'inventory-suppliers',
    path: 'inventory/suppliers',
    moduleId: 'inventory',
    componentKey: 'page.inventorySuppliers',
  },
  {
    id: 'inventory-procurement',
    path: 'inventory/procurement',
    moduleId: 'inventory',
    componentKey: 'page.inventoryProcurement',
  },
  {
    id: 'inventory-warehouses',
    path: 'inventory/warehouses',
    moduleId: 'inventory',
    componentKey: 'page.inventoryWarehouses',
  },
  {
    id: 'inventory-warehouse-detail',
    path: 'inventory/warehouses/:warehouseId',
    moduleId: 'inventory',
    componentKey: 'page.inventoryWarehouseDetail',
  },
  {
    id: 'inventory-categories',
    path: 'inventory/categories',
    moduleId: 'inventory',
    componentKey: 'page.inventoryCategories',
  },
  {
    id: 'inventory-supplier-detail',
    path: 'inventory/suppliers/:supplierId',
    moduleId: 'inventory',
    componentKey: 'page.inventorySupplierDetail',
  },
  {
    id: 'inventory-transfers',
    path: 'inventory/transfers',
    moduleId: 'inventory',
    componentKey: 'page.inventoryTransfers',
  },
  {
    id: 'inventory-stock-counts',
    path: 'inventory/stock-counts',
    moduleId: 'inventory',
    componentKey: 'page.inventoryStockCounts',
  },
  {
    id: 'inventory-stock-requests',
    path: 'inventory/stock-requests',
    moduleId: 'inventory',
    componentKey: 'page.inventoryStockRequests',
  },
  {
    id: 'inventory-reports',
    path: 'inventory/reports',
    moduleId: 'inventory',
    componentKey: 'page.inventoryReports',
  },
  {
    id: 'inventory-item-detail',
    path: 'inventory/items/:itemId',
    moduleId: 'inventory',
    componentKey: 'page.inventoryItemDetail',
  },

  { id: 'reports', path: 'reports', moduleId: 'reporting', componentKey: 'page.reportingHome' },
  {
    id: 'reports-category',
    path: 'reports/category/:categoryId',
    moduleId: 'reporting',
    componentKey: 'page.reportCategory',
  },
  { id: 'reports-builder', path: 'reports/builder', moduleId: 'reporting', componentKey: 'page.reportBuilder' },
  { id: 'reports-export', path: 'reports/export', moduleId: 'reporting', componentKey: 'page.reportExport' },
  {
    id: 'reports-detail',
    path: 'reports/:reportId',
    moduleId: 'reporting',
    componentKey: 'page.reportDetail',
  },

  { id: 'analytics', path: 'analytics', moduleId: 'analytics', componentKey: 'page.analyticsHome' },
  { id: 'analytics-executive', path: 'analytics/executive', moduleId: 'analytics', componentKey: 'page.analyticsExecutive' },
  { id: 'analytics-financial', path: 'analytics/financial', moduleId: 'analytics', componentKey: 'page.analyticsFinancial' },
  { id: 'analytics-patients', path: 'analytics/patients', moduleId: 'analytics', componentKey: 'page.analyticsPatients' },
  { id: 'analytics-operations', path: 'analytics/operations', moduleId: 'analytics', componentKey: 'page.analyticsOperations' },
  { id: 'analytics-inventory', path: 'analytics/inventory', moduleId: 'analytics', componentKey: 'page.analyticsInventory' },
  { id: 'analytics-clinical', path: 'analytics/clinical', moduleId: 'analytics', componentKey: 'page.analyticsClinical' },
  { id: 'analytics-dental', path: 'analytics/dental', moduleId: 'analytics', componentKey: 'page.analyticsDental' },
  { id: 'analytics-beauty', path: 'analytics/beauty', moduleId: 'analytics', componentKey: 'page.analyticsBeauty' },
  { id: 'analytics-staff', path: 'analytics/staff', moduleId: 'analytics', componentKey: 'page.analyticsStaff' },
  { id: 'analytics-branches', path: 'analytics/branches', moduleId: 'analytics', componentKey: 'page.analyticsBranches' },
  {
    id: 'analytics-forecasting',
    path: 'analytics/forecasting',
    moduleId: 'analytics',
    componentKey: 'page.analyticsForecasting',
  },
  { id: 'analytics-builder', path: 'analytics/builder', moduleId: 'analytics', componentKey: 'page.analyticsBuilder' },
  { id: 'analytics-export', path: 'analytics/export', moduleId: 'analytics', componentKey: 'page.analyticsExport' },

  {
    id: 'workflows',
    path: 'workflows',
    moduleId: 'workflow',
    componentKey: 'layout.workflow',
    layoutKey: 'workflow',
    children: [
      { id: 'workflows-home', index: true, moduleId: 'workflow', componentKey: 'page.workflowsHome' },
      { id: 'workflows-instances', path: 'instances', moduleId: 'workflow', componentKey: 'page.workflowsInstances' },
      {
        id: 'workflows-instance-detail',
        path: 'instances/:workflowId',
        moduleId: 'workflow',
        componentKey: 'page.workflowDetail',
      },
      { id: 'workflows-tasks', path: 'tasks', moduleId: 'workflow', componentKey: 'page.workflowTasks' },
      { id: 'workflows-approvals', path: 'approvals', moduleId: 'workflow', componentKey: 'page.workflowApprovals' },
      { id: 'workflows-builder', path: 'builder', moduleId: 'workflow', componentKey: 'page.workflowBuilder' },
      { id: 'workflows-templates', path: 'templates', moduleId: 'workflow', componentKey: 'page.workflowTemplates' },
      { id: 'workflows-automation', path: 'automation', moduleId: 'workflow', componentKey: 'page.workflowAutomation' },
      { id: 'workflows-monitoring', path: 'monitoring', moduleId: 'workflow', componentKey: 'page.workflowMonitoring' },
      { id: 'workflows-logs', path: 'logs', moduleId: 'workflow', componentKey: 'page.workflowLogs' },
      { id: 'workflows-audit', path: 'audit', moduleId: 'workflow', componentKey: 'page.workflowAudit' },
    ],
  },

  {
    id: 'ai',
    path: 'ai',
    moduleId: 'ai',
    componentKey: 'layout.ai',
    layoutKey: 'ai',
    children: [
      { id: 'ai-home', index: true, moduleId: 'ai', componentKey: 'page.aiHome' },
      { id: 'ai-chat', path: 'chat/:conversationId?', moduleId: 'ai', componentKey: 'page.aiChat' },
      { id: 'ai-workspace', path: 'workspaces/:workspaceId', moduleId: 'ai', componentKey: 'page.aiWorkspace' },
      { id: 'ai-prompts', path: 'prompts', moduleId: 'ai', componentKey: 'page.aiPrompts' },
      { id: 'ai-history', path: 'history', moduleId: 'ai', componentKey: 'page.aiHistory' },
      { id: 'ai-settings', path: 'settings', moduleId: 'ai', componentKey: 'page.aiSettings' },
      { id: 'ai-admin', path: 'admin', moduleId: 'ai', componentKey: 'page.aiAdmin' },
    ],
  },

  {
    id: 'settings',
    path: 'settings',
    moduleId: 'settings',
    componentKey: 'core.settingsGroup',
    children: [
      {
        id: 'settings-layout',
        moduleId: 'settings',
        componentKey: 'layout.settings',
        layoutKey: 'settings',
        children: [
          { id: 'settings-home', index: true, moduleId: 'settings', componentKey: 'page.settingsHome' },
          { id: 'settings-general', path: 'general', moduleId: 'settings', componentKey: 'page.settingsGeneral' },
          { id: 'settings-profile', path: 'profile', moduleId: 'settings', componentKey: 'page.settingsProfile' },
          {
            id: 'settings-localization',
            path: 'localization',
            moduleId: 'settings',
            componentKey: 'page.settingsLocalization',
          },
          { id: 'settings-branding', path: 'branding', moduleId: 'settings', componentKey: 'page.settingsBranding' },
          { id: 'settings-features', path: 'features', moduleId: 'settings', componentKey: 'page.settingsFeatures' },
          { id: 'settings-branches', path: 'branches', moduleId: 'settings', componentKey: 'page.settingsBranches' },
          { id: 'settings-search', path: 'search', moduleId: 'settings', componentKey: 'page.settingsSearch' },
          { id: 'settings-billing', path: 'billing', moduleId: 'settings', componentKey: 'page.settingsBilling' },
          {
            id: 'settings-clinical-services',
            path: 'clinical-services',
            moduleId: 'settings',
            componentKey: 'page.clinicalServices',
          },
          { id: 'settings-inventory', path: 'inventory', moduleId: 'settings', componentKey: 'page.settingsInventory' },
          { id: 'settings-reports', path: 'reports', moduleId: 'settings', componentKey: 'page.settingsReports' },
          {
            id: 'settings-integrations',
            path: 'integrations',
            moduleId: 'settings',
            componentKey: 'page.settingsIntegrations',
          },
          { id: 'settings-audit', path: 'audit', moduleId: 'settings', componentKey: 'page.settingsAudit' },
          { id: 'settings-developer', path: 'developer', moduleId: 'settings', componentKey: 'page.settingsDeveloper' },
          {
            id: 'settings-notification-defaults',
            path: 'notification-defaults',
            moduleId: 'settings',
            componentKey: 'page.settingsNotificationDefaults',
          },
          {
            id: 'settings-security-policies',
            path: 'security-policies',
            moduleId: 'settings',
            componentKey: 'page.settingsSecurityPolicies',
          },
          { id: 'settings-advanced', path: 'advanced', moduleId: 'settings', componentKey: 'page.settingsAdvanced' },
        ],
      },
      {
        id: 'settings-security',
        path: 'security',
        moduleId: 'settings',
        componentKey: 'layout.security',
        layoutKey: 'security',
        children: [
          { id: 'security-home', index: true, moduleId: 'settings', componentKey: 'page.securityAccount' },
          { id: 'security-password', path: 'password', moduleId: 'settings', componentKey: 'page.securityPassword' },
          { id: 'security-sessions', path: 'sessions', moduleId: 'settings', componentKey: 'page.securitySessions' },
          { id: 'security-devices', path: 'devices', moduleId: 'settings', componentKey: 'page.securityDevices' },
          { id: 'security-mfa', path: 'mfa', moduleId: 'settings', componentKey: 'page.securityMfa' },
          { id: 'security-profile', path: 'profile', moduleId: 'settings', componentKey: 'page.securityProfile' },
        ],
      },
      {
        id: 'settings-users',
        path: 'users',
        moduleId: 'userManagement',
        componentKey: 'layout.users',
        layoutKey: 'users',
        children: [
          { id: 'users-home', index: true, moduleId: 'userManagement', componentKey: 'page.usersHome' },
          { id: 'users-directory', path: 'directory', moduleId: 'userManagement', componentKey: 'page.usersDirectory' },
          { id: 'users-create', path: 'create', moduleId: 'userManagement', componentKey: 'page.usersCreate' },
          { id: 'users-invite', path: 'invite', moduleId: 'userManagement', componentKey: 'page.usersInvite' },
          { id: 'users-audit', path: 'audit', moduleId: 'userManagement', componentKey: 'page.usersAudit' },
          {
            id: 'users-invitations',
            path: 'invitations',
            moduleId: 'userManagement',
            componentKey: 'page.usersInvitations',
          },
          { id: 'users-roles', path: 'roles', moduleId: 'userManagement', componentKey: 'page.usersRoles' },
          { id: 'users-detail', path: ':userId', moduleId: 'userManagement', componentKey: 'page.userDetail' },
        ],
      },
      {
        id: 'settings-notifications',
        path: 'notifications',
        moduleId: 'notifications',
        componentKey: 'layout.notifications',
        layoutKey: 'notifications',
        children: [
          { id: 'notifications-home', index: true, moduleId: 'notifications', componentKey: 'page.notificationsHome' },
          { id: 'notifications-inbox', path: 'inbox', moduleId: 'notifications', componentKey: 'page.notificationsInbox' },
          {
            id: 'notifications-detail',
            path: 'inbox/:notificationId',
            moduleId: 'notifications',
            componentKey: 'page.notificationDetail',
          },
          { id: 'notifications-compose', path: 'compose', moduleId: 'notifications', componentKey: 'page.notificationsCompose' },
          { id: 'notifications-drafts', path: 'drafts', moduleId: 'notifications', componentKey: 'page.notificationsDrafts' },
          {
            id: 'notifications-templates',
            path: 'templates',
            moduleId: 'notifications',
            componentKey: 'page.notificationsTemplates',
          },
          {
            id: 'notifications-automation',
            path: 'automation',
            moduleId: 'notifications',
            componentKey: 'page.notificationsAutomation',
          },
          {
            id: 'notifications-delivery',
            path: 'delivery',
            moduleId: 'notifications',
            componentKey: 'page.notificationsDelivery',
          },
          {
            id: 'notifications-channels',
            path: 'channels',
            moduleId: 'notifications',
            componentKey: 'page.notificationsChannels',
          },
          {
            id: 'notifications-preferences',
            path: 'preferences',
            moduleId: 'notifications',
            componentKey: 'page.notificationsPreferences',
          },
        ],
      },
      {
        id: 'settings-import-export',
        path: 'import-export',
        moduleId: 'settings',
        componentKey: 'layout.importExport',
        layoutKey: 'importExport',
        children: [
          { id: 'ie-home', index: true, moduleId: 'settings', componentKey: 'page.importExportHome' },
          { id: 'ie-imports', path: 'imports', moduleId: 'settings', componentKey: 'page.importExportImports' },
          { id: 'ie-import-new', path: 'imports/new', moduleId: 'settings', componentKey: 'page.importExportImportWizard' },
          { id: 'ie-exports', path: 'exports', moduleId: 'settings', componentKey: 'page.importExportExports' },
          { id: 'ie-export-new', path: 'exports/new', moduleId: 'settings', componentKey: 'page.importExportExportWizard' },
          { id: 'ie-jobs', path: 'jobs', moduleId: 'settings', componentKey: 'page.importExportJobs' },
          { id: 'ie-job-detail', path: 'jobs/:jobId', moduleId: 'settings', componentKey: 'page.importExportJobDetail' },
          { id: 'ie-catalog', path: 'catalog', moduleId: 'settings', componentKey: 'page.importExportCatalog' },
          { id: 'ie-artifacts', path: 'artifacts', moduleId: 'settings', componentKey: 'page.importExportArtifacts' },
          { id: 'ie-health', path: 'health', moduleId: 'settings', componentKey: 'page.importExportHealth' },
        ],
      },
      {
        id: 'settings-backup-restore',
        path: 'backup-restore',
        moduleId: 'settings',
        componentKey: 'layout.backupRestore',
        layoutKey: 'backupRestore',
        children: [
          { id: 'br-home', index: true, moduleId: 'settings', componentKey: 'page.backupRestoreHome' },
          { id: 'br-jobs', path: 'jobs', moduleId: 'settings', componentKey: 'page.backupRestoreJobs' },
          { id: 'br-job-detail', path: 'jobs/:jobId', moduleId: 'settings', componentKey: 'page.backupRestoreJobDetail' },
          { id: 'br-backups', path: 'backups', moduleId: 'settings', componentKey: 'page.backupRestoreBackups' },
          { id: 'br-backup-new', path: 'backups/new', moduleId: 'settings', componentKey: 'page.backupRestoreBackupRequest' },
          { id: 'br-restores', path: 'restores', moduleId: 'settings', componentKey: 'page.backupRestoreRestores' },
          { id: 'br-restore-new', path: 'restores/new', moduleId: 'settings', componentKey: 'page.backupRestoreRestoreRequest' },
          { id: 'br-snapshots', path: 'snapshots', moduleId: 'settings', componentKey: 'page.backupRestoreSnapshots' },
          { id: 'br-verification', path: 'verification', moduleId: 'settings', componentKey: 'page.backupRestoreVerification' },
          { id: 'br-retention', path: 'retention', moduleId: 'settings', componentKey: 'page.backupRestoreRetention' },
          { id: 'br-recovery-points', path: 'recovery-points', moduleId: 'settings', componentKey: 'page.backupRestoreRecoveryPoints' },
          { id: 'br-catalog', path: 'catalog', moduleId: 'settings', componentKey: 'page.backupRestoreCatalog' },
          { id: 'br-health', path: 'health', moduleId: 'settings', componentKey: 'page.backupRestoreHealth' },
        ],
      },
      {
        id: 'settings-api-integrations',
        path: 'api-integrations',
        moduleId: 'settings',
        componentKey: 'layout.apiIntegrations',
        layoutKey: 'apiIntegrations',
        children: [
          { id: 'api-integrations-home', index: true, moduleId: 'settings', componentKey: 'page.apiIntegrationsHome' },
          { id: 'api-integrations-credentials', path: 'credentials', moduleId: 'settings', componentKey: 'page.apiIntegrationsCredentials' },
          { id: 'api-integrations-credentials-new', path: 'credentials/new', moduleId: 'settings', componentKey: 'page.apiIntegrationsCredentialCreate' },
          { id: 'api-integrations-credentials-detail', path: 'credentials/:id', moduleId: 'settings', componentKey: 'page.apiIntegrationsCredentialDetail' },
          { id: 'api-integrations-service-accounts', path: 'service-accounts', moduleId: 'settings', componentKey: 'page.apiIntegrationsServiceAccounts' },
          { id: 'api-integrations-scopes', path: 'scopes', moduleId: 'settings', componentKey: 'page.apiIntegrationsScopes' },
          { id: 'api-integrations-providers', path: 'providers', moduleId: 'settings', componentKey: 'page.apiIntegrationsProviders' },
          { id: 'api-integrations-webhooks', path: 'webhooks', moduleId: 'settings', componentKey: 'page.apiIntegrationsWebhooks' },
          { id: 'api-integrations-deliveries', path: 'deliveries', moduleId: 'settings', componentKey: 'page.apiIntegrationsDeliveries' },
          { id: 'api-integrations-gateway', path: 'gateway', moduleId: 'settings', componentKey: 'page.apiIntegrationsGateway' },
          { id: 'api-integrations-quotas', path: 'quotas', moduleId: 'settings', componentKey: 'page.apiIntegrationsQuotas' },
          { id: 'api-integrations-metrics', path: 'metrics', moduleId: 'settings', componentKey: 'page.apiIntegrationsMetrics' },
          { id: 'api-integrations-permissions', path: 'permissions', moduleId: 'settings', componentKey: 'page.apiIntegrationsPermissions' },
          { id: 'api-integrations-configuration', path: 'configuration', moduleId: 'settings', componentKey: 'page.apiIntegrationsConfiguration' },
          { id: 'api-integrations-health', path: 'health', moduleId: 'settings', componentKey: 'page.apiIntegrationsHealth' },
        ],
      },
      {
        id: 'settings-subscription',
        path: 'subscription',
        moduleId: 'settings',
        componentKey: 'layout.subscription',
        layoutKey: 'subscription',
        children: [
          {
            id: 'subscription-home',
            index: true,
            moduleId: 'settings',
            componentKey: 'page.subscriptionDashboard',
          },
          { id: 'subscription-plans', path: 'plans', moduleId: 'settings', componentKey: 'page.subscriptionPlans' },
          {
            id: 'subscription-features',
            path: 'features',
            moduleId: 'settings',
            componentKey: 'page.subscriptionFeatures',
          },
          { id: 'subscription-usage', path: 'usage', moduleId: 'settings', componentKey: 'page.subscriptionUsage' },
          {
            id: 'subscription-ai-usage',
            path: 'ai-usage',
            moduleId: 'settings',
            componentKey: 'page.subscriptionAiUsage',
          },
          {
            id: 'subscription-invoices',
            path: 'invoices',
            moduleId: 'settings',
            componentKey: 'page.subscriptionInvoices',
          },
          {
            id: 'subscription-payments',
            path: 'payments',
            moduleId: 'settings',
            componentKey: 'page.subscriptionPayments',
          },
          { id: 'subscription-license', path: 'license', moduleId: 'settings', componentKey: 'page.subscriptionLicense' },
          {
            id: 'subscription-analytics',
            path: 'analytics',
            moduleId: 'settings',
            componentKey: 'page.subscriptionAnalytics',
          },
          { id: 'subscription-admin', path: 'admin', moduleId: 'settings', componentKey: 'page.subscriptionAdmin' },
        ],
      },
    ],
  },
];

/** Auth and kiosk routes — always static (not registry-gated). */
export const STATIC_AUTH_ROUTE_CATALOG: RouteCatalogEntry[] = [];

export function normalizeCatalogPath(path: string): string {
  if (!path || path === '/') return '/';
  return path.startsWith('/') ? path : `/${path}`;
}

function normalizeCatalogPathLocal(path: string): string {
  return normalizeCatalogPath(path);
}

export function flattenCatalogPaths(entries: readonly RouteCatalogEntry[], prefix = ''): string[] {
  const paths: string[] = [];
  for (const entry of entries) {
    if (entry.index) {
      paths.push(normalizeCatalogPathLocal(prefix || '/'));
    } else if (entry.path) {
      const joined = prefix ? `${prefix}/${entry.path}` : entry.path;
      paths.push(normalizeCatalogPathLocal(joined));
    }
    if (entry.children?.length) {
      const childPrefix = entry.index
        ? prefix
        : entry.path
          ? prefix
            ? `${prefix}/${entry.path}`
            : entry.path
          : prefix;
      paths.push(...flattenCatalogPaths(entry.children, childPrefix));
    }
  }
  return paths;
}

export function collectKioskRoutes(entries: RouteCatalogEntry[]): RouteCatalogEntry[] {
  const kiosk: RouteCatalogEntry[] = [];
  for (const entry of entries) {
    if (entry.kioskRoute) kiosk.push(entry);
    if (entry.children) kiosk.push(...collectKioskRoutes(entry.children));
  }
  return kiosk;
}

export function collectShellRoutes(entries: RouteCatalogEntry[]): RouteCatalogEntry[] {
  return entries.filter((entry) => !entry.kioskRoute);
}
