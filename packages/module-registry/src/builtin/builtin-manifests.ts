import type {
  LicensedModuleId,
  ModuleCategory,
  ModuleDependency,
  ModuleFeatureFlagDecl,
  ModuleManifest,
  SearchContribution,
} from '../types';
import { BUILTIN_MANIFEST_VERSION } from '../types';
import {
  capabilitiesFromExtensions,
  moduleAiWorkspace,
  moduleNotificationEvent,
  moduleWorkflowTrigger,
  rootRoute,
  settingsNav,
  sidebarNav,
  topNav,
  type ModuleExtensionBundle,
} from './extension-builders';
import { buildBranchContributionsForModule } from '../branch/build-branch-contributions';
import { validateBuiltinBranchIntegrity } from '../branch/validate-branch-integrity';
import { buildAnalyticsContributionsForModule } from '../analytics/build-analytics-contributions';
import { validateBuiltinAnalyticsIntegrity } from '../analytics/validate-analytics-integrity';
import { buildWhiteLabelContributionsForModule } from '../whitelabel/build-white-label-contributions';
import { validateBuiltinWhiteLabelIntegrity } from '../whitelabel/validate-white-label-integrity';
import { buildDashboardContributionsForModule } from '../dashboard/build-dashboard-contributions';
import { validateBuiltinDashboardIntegrity } from '../dashboard/validate-dashboard-integrity';
import { buildReportingContributionsForModule } from '../reporting/build-report-contributions';
import { validateBuiltinReportIntegrity } from '../reporting/validate-report-integrity';
import { buildSearchContributionsForModule } from '../search/build-search-contributions';
import { validateBuiltinSearchIntegrity } from '../search/validate-search-integrity';
import { buildActivityContributionsForModule } from '../activity/build-activity-contributions';
import { validateBuiltinActivityIntegrity } from '../activity/validate-activity-integrity';
import { buildAuditContributionsForModule } from '../audit/build-audit-contributions';
import { validateBuiltinAuditIntegrity } from '../audit/validate-audit-integrity';
import { buildJourneyContributionsForModule } from '../journey/build-journey-contributions';
import { validateBuiltinJourneyIntegrity } from '../journey/validate-journey-integrity';
import { buildNotificationContributionsForModule } from '../notification/build-notification-contributions';
import { validateBuiltinNotificationIntegrity } from '../notification/validate-notification-integrity';

interface BuiltinModuleSeed {
  moduleId: LicensedModuleId;
  category: ModuleCategory;
  sortOrder: number;
  icon: string;
  nestModule: string;
  frontendChunk: string;
  resources: string[];
  healthPath: string;
  dependencies?: ModuleDependency[];
  clinicalDomains?: ('medical' | 'dental' | 'beauty')[];
  settingsPath?: string;
  featureFlags?: ModuleFeatureFlagDecl[];
  buildExtensions: (seed: BuiltinModuleSeed) => ModuleExtensionBundle;
}

function moduleSearchContributions(moduleId: LicensedModuleId): SearchContribution[] | undefined {
  const contributions = buildSearchContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleReportingContributions(moduleId: LicensedModuleId) {
  const contributions = buildReportingContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleWhiteLabelContributions(moduleId: LicensedModuleId) {
  const contributions = buildWhiteLabelContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleAnalyticsContributions(moduleId: LicensedModuleId) {
  const contributions = buildAnalyticsContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleBranchContributions(moduleId: LicensedModuleId) {
  const contributions = buildBranchContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleActivityContributions(moduleId: LicensedModuleId) {
  const contributions = buildActivityContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleAuditContributions(moduleId: LicensedModuleId) {
  const contributions = buildAuditContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleJourneyContributions(moduleId: LicensedModuleId) {
  const contributions = buildJourneyContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function moduleNotificationContributions(moduleId: LicensedModuleId) {
  const contributions = buildNotificationContributionsForModule(moduleId);
  return contributions.length > 0 ? contributions : undefined;
}

function manifestFromSeed(seed: BuiltinModuleSeed): ModuleManifest {
  const version = BUILTIN_MANIFEST_VERSION;
  const manifestId = `${seed.moduleId}@${version}`;
  const extensions = seed.buildExtensions(seed);

  return {
    moduleManifestSchemaVersion: '1.0',
    manifestId,
    moduleId: seed.moduleId,
    version,
    minPlatformVersion: '1.0.0',
    catalogStatus: 'validated',
    identity: {
      displayNameKey: `modules.${seed.moduleId}.name`,
      descriptionKey: `modules.${seed.moduleId}.description`,
      category: seed.category,
    },
    metadata: {
      sortOrder: seed.sortOrder,
      clinicalDomains: seed.clinicalDomains,
      auditClassification: seed.category === 'platform' ? 'platform' : 'standard',
      keywords: [seed.moduleId, seed.category],
    },
    compatibility: {
      nestModule: seed.nestModule,
      frontendChunk: seed.frontendChunk,
    },
    dependencies: seed.dependencies ?? [],
    licensing: {
      licensedModuleId: seed.moduleId,
    },
    permissions: {
      resources: seed.resources.map((resourceId) => ({
        resourceId,
        actions: ['view', 'create', 'update', 'delete'] as const,
      })),
      defaultActions: ['view'],
    },
    presentation: {
      visibility: { default: 'visible', showWhenLocked: true },
      icons: { default: seed.icon },
    },
    extensions,
    localization: {
      namespace: `modules.${seed.moduleId}`,
      fallbackLocale: 'en',
      locales: ['en'],
    },
    assets: {
      iconUrl: `/assets/modules/${seed.moduleId}/icon.svg`,
    },
    settings: seed.settingsPath ? { settingsPath: seed.settingsPath } : undefined,
    featureFlags: seed.featureFlags,
    healthChecks: [
      {
        probeId: `${seed.moduleId}-api`,
        type: 'backend',
        target: seed.healthPath,
        required: false,
        intervalSeconds: 300,
        timeoutMs: 5000,
      },
      {
        probeId: `${seed.moduleId}-chunk`,
        type: 'frontend-chunk',
        target: seed.frontendChunk,
        required: false,
        intervalSeconds: 600,
        timeoutMs: 8000,
      },
    ],
    capabilities: capabilitiesFromExtensions(extensions),
  };
}

const BUILTIN_MODULE_SEEDS: BuiltinModuleSeed[] = [
  {
    moduleId: 'dashboard',
    category: 'platform',
    sortOrder: 0,
    icon: 'LayoutDashboard',
    nestModule: 'DashboardModule',
    frontendChunk: 'dashboard',
    resources: ['api.identity'],
    healthPath: '/dashboard/overview',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/', 'nav.dashboard', s.sortOrder, s.icon)],
      routing: [rootRoute(s.moduleId, '/*', 'module.dashboard', 'nav.dashboard')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'scheduling',
    category: 'operations',
    sortOrder: 10,
    icon: 'Calendar',
    nestModule: 'SchedulingModule',
    frontendChunk: 'scheduling',
    resources: ['api.scheduling'],
    healthPath: '/scheduling/appointments',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/appointments', 'nav.appointments', s.sortOrder, s.icon, 'api.scheduling')],
      routing: [rootRoute(s.moduleId, '/appointments/*', 'module.scheduling', 'nav.appointments', 'api.scheduling')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
      workflow: [moduleWorkflowTrigger(s.moduleId, 'appointment.created', 'modules.scheduling.workflow.created', 'api.scheduling')],
      notifications: [moduleNotificationEvent(s.moduleId, 'appointment.reminder', 'modules.scheduling.notifications.reminder', 'api.scheduling')],
    }),
  },
  {
    moduleId: 'queue',
    category: 'operations',
    sortOrder: 20,
    icon: 'Users',
    nestModule: 'QueueModule',
    frontendChunk: 'queue',
    resources: ['api.queue'],
    healthPath: '/queue/tickets',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/queue', 'nav.queue', s.sortOrder, s.icon, 'api.queue')],
      routing: [rootRoute(s.moduleId, '/queue/*', 'module.queue', 'nav.queue', 'api.queue')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
      notifications: [moduleNotificationEvent(s.moduleId, 'queue.called', 'modules.queue.notifications.called', 'api.queue')],
    }),
  },
  {
    moduleId: 'patients',
    category: 'clinical',
    sortOrder: 30,
    icon: 'UserRound',
    nestModule: 'PatientsModule',
    frontendChunk: 'patients',
    resources: ['api.patients'],
    healthPath: '/patients',
    clinicalDomains: ['medical'],
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/patients', 'nav.patients', s.sortOrder, s.icon, 'api.patients')],
      routing: [rootRoute(s.moduleId, '/patients/*', 'module.patients', 'nav.patients', 'api.patients')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'emr',
    category: 'clinical',
    sortOrder: 40,
    icon: 'Stethoscope',
    nestModule: 'EMRModule',
    frontendChunk: 'emr',
    resources: ['api.emr'],
    healthPath: '/emr/encounters',
    clinicalDomains: ['medical'],
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/encounters', 'nav.encounters', s.sortOrder, s.icon, 'api.emr')],
      routing: [rootRoute(s.moduleId, '/encounters/*', 'module.emr', 'nav.encounters', 'api.emr')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      workflow: [moduleWorkflowTrigger(s.moduleId, 'encounter.completed', 'modules.emr.workflow.completed', 'api.emr')],
    }),
  },
  {
    moduleId: 'dental',
    category: 'clinical',
    sortOrder: 50,
    icon: 'Smile',
    nestModule: 'DentalModule',
    frontendChunk: 'dental',
    resources: ['api.dental'],
    healthPath: '/dental/records',
    clinicalDomains: ['dental'],
    dependencies: [{ moduleId: 'emr', type: 'optional', semverRange: '^1.0.0' }],
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/dental', 'nav.dental', s.sortOrder, s.icon, 'api.dental')],
      routing: [rootRoute(s.moduleId, '/dental/*', 'module.dental', 'nav.dental', 'api.dental')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      analytics: moduleAnalyticsContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'beauty',
    category: 'clinical',
    sortOrder: 60,
    icon: 'Sparkles',
    nestModule: 'BeautyModule',
    frontendChunk: 'beauty',
    resources: ['api.beauty'],
    healthPath: '/beauty/records',
    clinicalDomains: ['beauty'],
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/beauty', 'nav.beauty', s.sortOrder, s.icon, 'api.beauty')],
      routing: [rootRoute(s.moduleId, '/beauty/*', 'module.beauty', 'nav.beauty', 'api.beauty')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'billing',
    category: 'financial',
    sortOrder: 70,
    icon: 'Receipt',
    nestModule: 'BillingModule',
    frontendChunk: 'billing',
    resources: ['api.billing'],
    healthPath: '/billing/invoices',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/billing', 'nav.billing', s.sortOrder, s.icon, 'api.billing')],
      routing: [rootRoute(s.moduleId, '/billing/*', 'module.billing', 'nav.billing', 'api.billing')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      analytics: moduleAnalyticsContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
      workflow: [moduleWorkflowTrigger(s.moduleId, 'invoice.overdue', 'modules.billing.workflow.overdue', 'api.billing')],
      notifications: [moduleNotificationEvent(s.moduleId, 'invoice.issued', 'modules.billing.notifications.issued', 'api.billing')],
    }),
  },
  {
    moduleId: 'inventory',
    category: 'operations',
    sortOrder: 80,
    icon: 'Package',
    nestModule: 'InventoryModule',
    frontendChunk: 'inventory',
    resources: ['api.inventory'],
    healthPath: '/inventory/items',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/inventory', 'nav.inventory', s.sortOrder, s.icon, 'api.inventory')],
      routing: [rootRoute(s.moduleId, '/inventory/*', 'module.inventory', 'nav.inventory', 'api.inventory')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
      workflow: [moduleWorkflowTrigger(s.moduleId, 'inventory.lowStock', 'modules.inventory.workflow.lowStock', 'api.inventory')],
      notifications: [moduleNotificationEvent(s.moduleId, 'inventory.lowStock', 'modules.inventory.notifications.lowStock', 'api.inventory')],
    }),
  },
  {
    moduleId: 'reporting',
    category: 'analytics',
    sortOrder: 90,
    icon: 'FileBarChart',
    nestModule: 'ReportingModule',
    frontendChunk: 'reporting',
    resources: ['api.reporting'],
    healthPath: '/reporting/reports',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/reports', 'nav.reports', s.sortOrder, s.icon, 'api.reporting')],
      routing: [rootRoute(s.moduleId, '/reports/*', 'module.reporting', 'nav.reports', 'api.reporting')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'analytics',
    category: 'analytics',
    sortOrder: 100,
    icon: 'BarChart3',
    nestModule: 'AnalyticsModule',
    frontendChunk: 'analytics',
    resources: ['api.analytics'],
    healthPath: '/analytics/overview',
    dependencies: [{ moduleId: 'reporting', type: 'optional', semverRange: '^1.0.0' }],
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/analytics', 'nav.analytics', s.sortOrder, s.icon, 'api.analytics')],
      routing: [rootRoute(s.moduleId, '/analytics/*', 'module.analytics', 'nav.analytics', 'api.analytics')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      analytics: moduleAnalyticsContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
      dashboard: buildDashboardContributionsForModule(s.moduleId),
    }),
  },
  {
    moduleId: 'workflow',
    category: 'operations',
    sortOrder: 110,
    icon: 'GitBranch',
    nestModule: 'WorkflowModule',
    frontendChunk: 'workflow',
    resources: ['api.workflow'],
    healthPath: '/workflows/overview',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/workflows', 'nav.workflows', s.sortOrder, s.icon, 'api.workflow')],
      routing: [rootRoute(s.moduleId, '/workflows/*', 'module.workflow', 'nav.workflows', 'api.workflow')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      workflow: [
        moduleWorkflowTrigger(s.moduleId, 'workflow.started', 'modules.workflow.triggers.started', 'api.workflow'),
        moduleWorkflowTrigger(s.moduleId, 'workflow.approval', 'modules.workflow.triggers.approval', 'api.workflow'),
      ],
      notifications: [moduleNotificationEvent(s.moduleId, 'workflow.taskAssigned', 'modules.workflow.notifications.taskAssigned', 'api.workflow')],
    }),
  },
  {
    moduleId: 'ai',
    category: 'platform',
    sortOrder: 120,
    icon: 'Bot',
    nestModule: 'AiModule',
    frontendChunk: 'ai',
    resources: ['api.ai'],
    healthPath: '/ai/models',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/ai', 'nav.aiAssistant', s.sortOrder, s.icon, 'api.ai')],
      routing: [rootRoute(s.moduleId, '/ai/*', 'module.ai', 'nav.aiAssistant', 'api.ai')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      ai: [
        moduleAiWorkspace(s.moduleId, 'clinical-assistant', 'modules.ai.workspaces.clinical', 'api.ai', ['summarize', 'draft-note']),
        moduleAiWorkspace(s.moduleId, 'operations-assistant', 'modules.ai.workspaces.operations', 'api.ai', ['search', 'report']),
      ],
    }),
  },
  {
    moduleId: 'settings',
    category: 'administration',
    sortOrder: 130,
    icon: 'Settings',
    nestModule: 'SettingsModule',
    frontendChunk: 'settings',
    resources: ['api.settings', 'api.identity', 'api.subscription', 'api.audit'],
    healthPath: '/settings/overview',
    settingsPath: '/settings',
    buildExtensions: (s) => ({
      navigation: [
        sidebarNav(s.moduleId, '/settings', 'nav.settings', s.sortOrder, s.icon, 'api.identity'),
        {
          extensionId: `${s.moduleId}/nav/subscription`,
          labelKey: 'nav.subscription',
          sortOrder: 75,
          path: '/settings/subscription',
          placement: 'sidebar' as const,
          resourceId: 'api.subscription',
          icon: 'CreditCard',
        },
        settingsNav(s.moduleId, 'users', '/settings/users', 'nav.users', 10, 'Users', 'api.identity'),
        settingsNav(s.moduleId, 'notifications', '/settings/notifications', 'nav.notifications', 20, 'Bell', 'api.notifications'),
      ],
      routing: [rootRoute(s.moduleId, '/settings/*', 'module.settings', 'nav.settings', 'api.settings', 'SettingsLayout')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      whiteLabel: moduleWhiteLabelContributions(s.moduleId),
      branch: moduleBranchContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'notifications',
    category: 'communication',
    sortOrder: 140,
    icon: 'Bell',
    nestModule: 'NotificationModule',
    frontendChunk: 'notifications',
    resources: ['api.notifications'],
    healthPath: '/notifications',
    buildExtensions: (s) => ({
      routing: [rootRoute(s.moduleId, '/settings/notifications/*', 'module.notifications', 'nav.notifications', 'api.notifications', 'SettingsLayout')],
      dashboard: buildDashboardContributionsForModule(s.moduleId),
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      notifications: [
        moduleNotificationEvent(s.moduleId, 'message.sent', 'modules.notifications.events.sent', 'api.notifications'),
        moduleNotificationEvent(s.moduleId, 'message.failed', 'modules.notifications.events.failed', 'api.notifications'),
      ],
      workflow: [moduleWorkflowTrigger(s.moduleId, 'notification.dispatch', 'modules.notifications.workflow.dispatch', 'api.notifications')],
    }),
  },
  {
    moduleId: 'userManagement',
    category: 'administration',
    sortOrder: 150,
    icon: 'Users',
    nestModule: 'IdentityModule',
    frontendChunk: 'identity',
    resources: ['api.identity'],
    healthPath: '/identity/users',
    buildExtensions: (s) => ({
      routing: [rootRoute(s.moduleId, '/settings/users/*', 'module.userManagement', 'nav.users', 'api.identity', 'SettingsLayout')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      workflow: [moduleWorkflowTrigger(s.moduleId, 'user.invited', 'modules.userManagement.workflow.invited', 'api.identity')],
      notifications: [moduleNotificationEvent(s.moduleId, 'user.invited', 'modules.userManagement.notifications.invited', 'api.identity')],
    }),
  },
  {
    moduleId: 'patientPortal',
    category: 'platform',
    sortOrder: 160,
    icon: 'Globe',
    nestModule: 'PatientPortalModule',
    frontendChunk: 'patient-portal',
    resources: ['api.patient_portal'],
    healthPath: '/patient-portal',
    buildExtensions: (s) => ({
      navigation: [sidebarNav(s.moduleId, '/my-appointments', 'nav.myAppointments', 15, 'CalendarCheck', 'api.patient_portal')],
      routing: [
        rootRoute(s.moduleId, '/portal/*', 'module.patientPortal', 'modules.patientPortal.name', 'api.patient_portal'),
        rootRoute(s.moduleId, '/my-appointments/*', 'module.patientPortal.appointments', 'nav.myAppointments', 'api.patient_portal', 'AppShell', 'appointments'),
      ],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      notifications: [moduleNotificationEvent(s.moduleId, 'appointment.updated', 'modules.patientPortal.notifications.updated', 'api.patient_portal')],
    }),
  },
  {
    moduleId: 'search',
    category: 'platform',
    sortOrder: 170,
    icon: 'Search',
    nestModule: 'SearchModule',
    frontendChunk: 'search',
    resources: ['api.search'],
    healthPath: '/search',
    buildExtensions: (s) => ({
      navigation: [topNav(s.moduleId, '/search', 'nav.search', s.sortOrder, s.icon, 'api.search')],
      routing: [rootRoute(s.moduleId, '/search', 'module.search', 'nav.search', 'api.search')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'media',
    category: 'platform',
    sortOrder: 180,
    icon: 'Image',
    nestModule: 'MediaModule',
    frontendChunk: 'media',
    resources: ['api.media'],
    healthPath: '/media',
    buildExtensions: (s) => ({
      routing: [rootRoute(s.moduleId, '/media/*', 'module.media', 'modules.media.name', 'api.media')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'commission',
    category: 'financial',
    sortOrder: 190,
    icon: 'Percent',
    nestModule: 'CommissionModule',
    frontendChunk: 'commission',
    resources: ['api.commission'],
    healthPath: '/commission',
    dependencies: [{ moduleId: 'billing', type: 'optional', semverRange: '^1.0.0' }],
    buildExtensions: (s) => ({
      routing: [rootRoute(s.moduleId, '/billing/commission/*', 'module.commission', 'modules.commission.name', 'api.commission')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      analytics: moduleAnalyticsContributions(s.moduleId),
    }),
  },
  {
    moduleId: 'loyalty',
    category: 'financial',
    sortOrder: 200,
    icon: 'Gift',
    nestModule: 'LoyaltyModule',
    frontendChunk: 'loyalty',
    resources: ['api.loyalty'],
    healthPath: '/loyalty',
    dependencies: [{ moduleId: 'billing', type: 'optional', semverRange: '^1.0.0' }],
    buildExtensions: (s) => ({
      routing: [rootRoute(s.moduleId, '/billing/loyalty/*', 'module.loyalty', 'modules.loyalty.name', 'api.loyalty')],
      search: moduleSearchContributions(s.moduleId),
      activity: moduleActivityContributions(s.moduleId),
      audit: moduleAuditContributions(s.moduleId),
      journey: moduleJourneyContributions(s.moduleId),
      notification: moduleNotificationContributions(s.moduleId),
      reporting: moduleReportingContributions(s.moduleId),
      notifications: [moduleNotificationEvent(s.moduleId, 'loyalty.rewardEarned', 'modules.loyalty.notifications.rewardEarned', 'api.loyalty')],
    }),
  },
];

export const BUILTIN_MODULE_MANIFESTS: ModuleManifest[] = BUILTIN_MODULE_SEEDS.map(manifestFromSeed);

export function getBuiltinManifest(moduleId: LicensedModuleId): ModuleManifest | undefined {
  return BUILTIN_MODULE_MANIFESTS.find((m) => m.moduleId === moduleId);
}

/** Ensures every built-in manifest declares routing, localization, health, and licensing. */
export function validateBuiltinManifestCompleteness(manifests: ModuleManifest[] = BUILTIN_MODULE_MANIFESTS): string[] {
  const errors: string[] = [];
  for (const manifest of manifests) {
    if (!manifest.extensions.routing?.length) {
      errors.push(`${manifest.moduleId}: missing routing contribution`);
    }
    if (!manifest.localization?.namespace) {
      errors.push(`${manifest.moduleId}: missing localization namespace`);
    }
    if (!manifest.healthChecks?.length) {
      errors.push(`${manifest.moduleId}: missing health checks`);
    }
    if (!manifest.licensing.licensedModuleId) {
      errors.push(`${manifest.moduleId}: missing licensedModuleId`);
    }
    if (!manifest.capabilities?.length) {
      errors.push(`${manifest.moduleId}: missing capabilities`);
    }
  }
  if (manifests.length === BUILTIN_MODULE_MANIFESTS.length) {
    errors.push(...validateBuiltinDashboardIntegrity(manifests));
    errors.push(...validateBuiltinSearchIntegrity(manifests));
    errors.push(...validateBuiltinReportIntegrity(manifests));
    errors.push(...validateBuiltinAnalyticsIntegrity(manifests));
    errors.push(...validateBuiltinWhiteLabelIntegrity(manifests));
    errors.push(...validateBuiltinBranchIntegrity(manifests));
    errors.push(...validateBuiltinActivityIntegrity(manifests));
    errors.push(...validateBuiltinAuditIntegrity(manifests));
    errors.push(...validateBuiltinJourneyIntegrity(manifests));
    errors.push(...validateBuiltinNotificationIntegrity(manifests));
  }
  return errors;
}
