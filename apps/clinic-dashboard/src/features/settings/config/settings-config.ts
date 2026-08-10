import { hasPermission, type PermissionAction } from '@booking/permissions';

export type SettingsPermAction = PermissionAction;

export function buildSettingsPermCheck(roles: string[]) {
  return (action: SettingsPermAction) => hasPermission(roles, 'api.settings', action);
}

export function canViewSettings(perm: ReturnType<typeof buildSettingsPermCheck>) {
  return perm('view');
}

export function canEditSettings(perm: ReturnType<typeof buildSettingsPermCheck>) {
  return perm('update') || perm('manage');
}

export interface SettingsNavItem {
  id: string;
  to: string;
  labelKey: string;
  descriptionKey: string;
  groupKey: string;
  resourceId?: string;
  requiredAction?: SettingsPermAction;
  subscriptionFeature?: string;
  keywords: string[];
  external?: boolean;
}

export const SETTINGS_NAV: SettingsNavItem[] = [
  { id: 'home', to: '/settings', labelKey: 'settings.nav.home', descriptionKey: 'settings.nav.homeDesc', groupKey: 'settings.nav.groupOverview', keywords: ['overview', 'home', 'dashboard'] },
  { id: 'general', to: '/settings/general', labelKey: 'settings.nav.general', descriptionKey: 'settings.nav.generalDesc', groupKey: 'settings.nav.groupClinic', resourceId: 'api.settings', requiredAction: 'view', keywords: ['clinic', 'name', 'timezone', 'currency', 'hours'] },
  { id: 'profile', to: '/settings/profile', labelKey: 'settings.nav.profile', descriptionKey: 'settings.nav.profileDesc', groupKey: 'settings.nav.groupClinic', resourceId: 'api.settings', requiredAction: 'view', keywords: ['logo', 'specialty', 'medical', 'dental', 'beauty'] },
  { id: 'branches', to: '/settings/branches', labelKey: 'settings.nav.branches', descriptionKey: 'settings.nav.branchesDesc', groupKey: 'settings.nav.groupClinic', resourceId: 'api.settings', requiredAction: 'view', keywords: ['branch', 'location', 'department'] },
  { id: 'localization', to: '/settings/localization', labelKey: 'settings.nav.localization', descriptionKey: 'settings.nav.localizationDesc', groupKey: 'settings.nav.groupClinic', resourceId: 'api.settings', requiredAction: 'view', keywords: ['language', 'arabic', 'english', 'rtl', 'date', 'format'] },
  { id: 'branding', to: '/settings/branding', labelKey: 'settings.nav.branding', descriptionKey: 'settings.nav.brandingDesc', groupKey: 'settings.nav.groupClinic', resourceId: 'api.settings', requiredAction: 'view', subscriptionFeature: 'customBranding', keywords: ['brand', 'color', 'theme', 'invoice', 'pdf'] },
  { id: 'security', to: '/settings/security', labelKey: 'settings.nav.security', descriptionKey: 'settings.nav.securityDesc', groupKey: 'settings.nav.groupAccess', keywords: ['password', 'mfa', 'sessions', 'devices'] },
  { id: 'security-policies', to: '/settings/security-policies', labelKey: 'settings.nav.securityPolicies', descriptionKey: 'settings.nav.securityPoliciesDesc', groupKey: 'settings.nav.groupAccess', resourceId: 'api.settings', requiredAction: 'manage', keywords: ['password policy', 'mfa', 'session', 'lockout', 'ip'] },
  { id: 'users', to: '/settings/users', labelKey: 'settings.nav.users', descriptionKey: 'settings.nav.usersDesc', groupKey: 'settings.nav.groupAccess', resourceId: 'api.identity', requiredAction: 'view', keywords: ['users', 'roles', 'permissions', 'invitations'] },
  { id: 'notifications', to: '/settings/notifications', labelKey: 'settings.nav.notifications', descriptionKey: 'settings.nav.notificationsDesc', groupKey: 'settings.nav.groupCommunications', resourceId: 'api.notifications', requiredAction: 'view', keywords: ['email', 'sms', 'whatsapp', 'templates'] },
  { id: 'import-export', to: '/settings/import-export', labelKey: 'settings.nav.importExport', descriptionKey: 'settings.nav.importExportDesc', groupKey: 'settings.nav.groupOperations', resourceId: 'api.importExport', requiredAction: 'view', keywords: ['import', 'export', 'csv', 'xlsx', 'jobs', 'artifacts'] },
  { id: 'backup-restore', to: '/settings/backup-restore', labelKey: 'settings.nav.backupRestore', descriptionKey: 'settings.nav.backupRestoreDesc', groupKey: 'settings.nav.groupOperations', resourceId: 'api.backupRestore', requiredAction: 'view', keywords: ['backup', 'restore', 'snapshot', 'recovery', 'drill'] },
  { id: 'api-integrations', to: '/settings/api-integrations', labelKey: 'settings.nav.apiIntegrations', descriptionKey: 'settings.nav.apiIntegrationsDesc', groupKey: 'settings.nav.groupOperations', resourceId: 'api.integrations', requiredAction: 'view', keywords: ['api keys', 'integrations', 'webhooks', 'credentials', 'scopes'] },
  { id: 'notification-defaults', to: '/settings/notification-defaults', labelKey: 'settings.nav.notificationDefaults', descriptionKey: 'settings.nav.notificationDefaultsDesc', groupKey: 'settings.nav.groupCommunications', resourceId: 'api.settings', requiredAction: 'update', keywords: ['quiet hours', 'reminders', 'channels'] },
  { id: 'billing', to: '/settings/billing', labelKey: 'settings.nav.billing', descriptionKey: 'settings.nav.billingDesc', groupKey: 'settings.nav.groupFinance', resourceId: 'api.settings', requiredAction: 'view', keywords: ['invoice', 'tax', 'receipt', 'cashbox'] },
  { id: 'inventory', to: '/settings/inventory', labelKey: 'settings.nav.inventory', descriptionKey: 'settings.nav.inventoryDesc', groupKey: 'settings.nav.groupOperations', resourceId: 'api.settings', requiredAction: 'view', keywords: ['stock', 'warehouse', 'barcode', 'expiry'] },
  { id: 'ai', to: '/ai/settings', labelKey: 'settings.nav.ai', descriptionKey: 'settings.nav.aiDesc', groupKey: 'settings.nav.groupIntelligence', resourceId: 'api.ai', requiredAction: 'view', keywords: ['ai', 'copilot', 'model', 'provider'], external: true },
  { id: 'reports', to: '/settings/reports', labelKey: 'settings.nav.reports', descriptionKey: 'settings.nav.reportsDesc', groupKey: 'settings.nav.groupIntelligence', resourceId: 'api.settings', requiredAction: 'view', keywords: ['reports', 'export', 'pdf', 'scheduled'] },
  { id: 'integrations', to: '/settings/integrations', labelKey: 'settings.nav.integrations', descriptionKey: 'settings.nav.integrationsDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.settings', requiredAction: 'manage', subscriptionFeature: 'integrations', keywords: ['api', 'webhook', 'sms', 'payment gateway'] },
  { id: 'subscription', to: '/settings/subscription', labelKey: 'settings.nav.subscription', descriptionKey: 'settings.nav.subscriptionDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.subscription', requiredAction: 'view', keywords: ['plan', 'license', 'usage', 'upgrade'] },
  { id: 'features', to: '/settings/features', labelKey: 'settings.nav.features', descriptionKey: 'settings.nav.featuresDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.settings', requiredAction: 'manage', keywords: ['modules', 'flags', 'medical', 'dental', 'workflow'] },
  { id: 'audit', to: '/settings/audit', labelKey: 'settings.nav.audit', descriptionKey: 'settings.nav.auditDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.audit', requiredAction: 'view', keywords: ['audit', 'compliance', 'retention', 'export'] },
  { id: 'developer', to: '/settings/developer', labelKey: 'settings.nav.developer', descriptionKey: 'settings.nav.developerDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.settings', requiredAction: 'manage', subscriptionFeature: 'apiAccess', keywords: ['api keys', 'webhooks', 'sandbox'] },
  { id: 'advanced', to: '/settings/advanced', labelKey: 'settings.nav.advanced', descriptionKey: 'settings.nav.advancedDesc', groupKey: 'settings.nav.groupAdvanced', resourceId: 'api.settings', requiredAction: 'manage', keywords: ['retention', 'backup', 'import', 'export', 'maintenance'] },
];

export function filterSettingsNav(
  roles: string[],
  canUseFeature: (featureId: string) => boolean,
): SettingsNavItem[] {
  return SETTINGS_NAV.filter((item) => {
    if (item.id === 'home') {
      return hasPermission(roles, 'api.settings', 'view') || hasPermission(roles, 'api.identity', 'view');
    }
    if (item.subscriptionFeature && !canUseFeature(item.subscriptionFeature)) {
      if (item.id === 'developer' || item.id === 'integrations') {
        return hasPermission(roles, 'api.settings', item.requiredAction ?? 'view');
      }
    }
    if (item.resourceId && item.requiredAction) {
      return hasPermission(roles, item.resourceId, item.requiredAction);
    }
    return true;
  });
}

export function isSettingsNavLocked(item: SettingsNavItem, canUseFeature: (featureId: string) => boolean) {
  return Boolean(item.subscriptionFeature && !canUseFeature(item.subscriptionFeature));
}

export const CLINIC_TYPES = ['medical', 'dental', 'beauty', 'multi'] as const;
export const MODULE_FLAGS = [
  'medical',
  'dental',
  'beauty',
  'inventory',
  'billing',
  'reporting',
  'analytics',
  'workflow',
  'ai',
  'patientPortal',
  'advancedReports',
  'advancedAnalytics',
  'whiteLabel',
  'apiAccess',
] as const;
