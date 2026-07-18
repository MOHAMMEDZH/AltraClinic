import type {
  AiContribution,
  AnalyticsContribution,
  ActivityContribution,
  AuditContribution,
  DashboardContribution,
  JourneyContribution,
  LicensedModuleId,
  ModuleCapability,
  NavigationContribution,
  NotificationContribution,
  NotificationCenterContribution,
  ReportingContribution,
  RoutingContribution,
  SearchContribution,
  WhiteLabelContribution,
  BranchContribution,
  WorkflowContribution,
} from '../types';

export interface ModuleExtensionBundle {
  navigation?: NavigationContribution[];
  routing?: RoutingContribution[];
  dashboard?: DashboardContribution[];
  search?: SearchContribution[];
  reporting?: ReportingContribution[];
  analytics?: AnalyticsContribution[];
  workflow?: WorkflowContribution[];
  notifications?: NotificationContribution[];
  ai?: AiContribution[];
  whiteLabel?: WhiteLabelContribution[];
  branch?: BranchContribution[];
  activity?: ActivityContribution[];
  audit?: AuditContribution[];
  journey?: JourneyContribution[];
  notification?: NotificationCenterContribution[];
}

export function sidebarNav(
  moduleId: LicensedModuleId,
  path: string,
  labelKey: string,
  sortOrder: number,
  icon: string,
  resourceId?: string,
): NavigationContribution {
  return {
    extensionId: `${moduleId}/nav/primary`,
    labelKey,
    sortOrder,
    path,
    placement: 'sidebar',
    resourceId,
    icon,
  };
}

export function settingsNav(
  moduleId: LicensedModuleId,
  localId: string,
  path: string,
  labelKey: string,
  sortOrder: number,
  icon: string,
  resourceId: string,
): NavigationContribution {
  return {
    extensionId: `${moduleId}/nav/${localId}`,
    labelKey,
    sortOrder,
    path,
    placement: 'settings',
    resourceId,
    icon,
  };
}

export function topNav(
  moduleId: LicensedModuleId,
  path: string,
  labelKey: string,
  sortOrder: number,
  icon: string,
  resourceId: string,
): NavigationContribution {
  return {
    extensionId: `${moduleId}/nav/primary`,
    labelKey,
    sortOrder,
    path,
    placement: 'topNav',
    resourceId,
    icon,
  };
}

export function rootRoute(
  moduleId: LicensedModuleId,
  path: string,
  componentKey: string,
  labelKey: string,
  resourceId?: string,
  layoutKey: 'AppShell' | 'SettingsLayout' = 'AppShell',
  localId = 'root',
): RoutingContribution {
  return {
    extensionId: `${moduleId}/routing/${localId}`,
    labelKey,
    sortOrder: 0,
    path,
    componentKey,
    layoutKey,
    ...(resourceId ? { resourceId } : {}),
  };
}

export function moduleSearch(
  moduleId: LicensedModuleId,
  localId: string,
  entityType: string,
  resourceId: string,
  deepLinkTemplate: string,
  labelKey: string,
  options: {
    sortOrder?: number;
    searchScope: 'executable' | 'discovery';
    permissionResources?: string[];
    backendProviderKey?: string;
    discoveryKey?: string;
    deprecatedAliases?: string[];
  },
): SearchContribution {
  const permissionResources = options.permissionResources ?? [resourceId];
  return {
    extensionId: `${moduleId}/search/${localId}`,
    labelKey,
    sortOrder: options.sortOrder ?? 0,
    entityType,
    permissionResources,
    deepLinkTemplate,
    resourceId,
    backendProviderKey: options.backendProviderKey ?? `search.${moduleId}`,
    searchScope: options.searchScope,
    ...(options.discoveryKey ? { discoveryKey: options.discoveryKey } : {}),
    ...(options.deprecatedAliases?.length
      ? { deprecatedAliases: options.deprecatedAliases }
      : {}),
  };
}

export function moduleDashboardWidget(
  moduleId: LicensedModuleId,
  widgetId: string,
  componentKey: string,
  labelKey: string,
  sortOrder: number,
  resourceId?: string,
  profiles: string[] = ['owner', 'general_manager', 'branch_manager', 'doctor'],
): DashboardContribution {
  return {
    extensionId: `${moduleId}/dashboard/${widgetId}`,
    labelKey,
    sortOrder,
    widgetId,
    componentKey,
    span: 2,
    profiles,
    ...(resourceId ? { resourceId } : {}),
    category: moduleId,
  };
}

export function moduleReport(
  moduleId: LicensedModuleId,
  reportId: string,
  categoryKey: string,
  dataDomain: string,
  labelKey: string,
  resourceId: string,
  options?: Partial<Omit<ReportingContribution, 'extensionId' | 'labelKey' | 'reportId' | 'categoryKey' | 'dataDomain' | 'resourceId'>>,
): ReportingContribution {
  return {
    extensionId: `${moduleId}/reporting/${reportId}`,
    labelKey,
    sortOrder: options?.sortOrder ?? 0,
    reportId,
    categoryKey,
    dataDomain,
    resourceId,
    exportFormats: options?.exportFormats ?? ['pdf', 'csv', 'xlsx'],
    ...(options ?? {}),
  };
}

export function moduleAnalytics(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<
    AnalyticsContribution,
    'extensionId' | 'moduleId' | 'localId' | 'schemaVersion' | 'resourceId'
  > & {
    resourceId?: string;
  },
): AnalyticsContribution {
  const resourceId = options.resourceId ?? options.permissionResource;
  return {
    extensionId: `${moduleId}/analytics/${localId}`,
    moduleId,
    localId,
    schemaVersion: 1,
    resourceId,
    metricId: options.primaryMetricId ?? options.metricIds?.[0] ?? options.metricId,
    ...options,
  };
}

/** @deprecated Use moduleAnalytics() with canonical vocabulary builders */
export function moduleAnalyticsWidget(
  moduleId: LicensedModuleId,
  widgetCatalogId: string,
  labelKey: string,
  resourceId: string,
  metricId?: string,
): AnalyticsContribution {
  return moduleAnalytics(moduleId, widgetCatalogId, {
    analyticsId: `${moduleId}.${widgetCatalogId}`,
    labelKey,
    sortOrder: 0,
    widgetCatalogId,
    metricIds: metricId ? [metricId] : undefined,
    primaryMetricId: metricId,
    metricId,
    permissionResource: resourceId,
    resourceId,
    providerKey: 'analytics.builtin',
    analyticsKind: 'widget',
    categoryId: 'platform',
    dataDomain: 'platform',
    classification: 'platform',
    featureId: 'analytics',
    permissionAction: 'view',
    deepLinkTemplate: `/analytics/builder?widget=${widgetCatalogId}`,
    minimumPlan: 'professional',
  });
}

export function moduleWorkflowTrigger(
  moduleId: LicensedModuleId,
  triggerType: string,
  labelKey: string,
  resourceId: string,
): WorkflowContribution {
  return {
    extensionId: `${moduleId}/workflow/${triggerType}`,
    labelKey,
    sortOrder: 0,
    triggerType,
    resourceId,
  };
}

export function moduleNotificationEvent(
  moduleId: LicensedModuleId,
  eventType: string,
  labelKey: string,
  resourceId: string,
): NotificationContribution {
  return {
    extensionId: `${moduleId}/notifications/${eventType}`,
    labelKey,
    sortOrder: 0,
    eventType,
    templateKey: `notifications.${moduleId}.${eventType}`,
    channels: ['email', 'in_app'],
    resourceId,
  };
}

export function moduleAiWorkspace(
  moduleId: LicensedModuleId,
  workspaceId: string,
  labelKey: string,
  resourceId: string,
  toolIds: string[] = [],
): AiContribution {
  return {
    extensionId: `${moduleId}/ai/${workspaceId}`,
    labelKey,
    sortOrder: 0,
    workspaceId,
    toolIds,
    resourceId,
  };
}

export function moduleWhiteLabel(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<WhiteLabelContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): WhiteLabelContribution {
  const resourceId = options.resourceId ?? options.adminResourceId;
  return {
    extensionId: `${moduleId}/whiteLabel/${localId}`,
    moduleId,
    localId,
    resourceId,
    ...options,
  };
}

export function moduleBranch(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<BranchContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): BranchContribution {
  const resourceId = options.resourceId ?? options.adminResourceId;
  return {
    extensionId: `${moduleId}/branch/${localId}`,
    moduleId,
    localId,
    resourceId,
    ...options,
  };
}

export function moduleActivity(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<ActivityContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): ActivityContribution {
  return {
    extensionId: `${moduleId}/activity/${localId}`,
    moduleId,
    localId,
    resourceId: options.resourceId,
    ...options,
  };
}

export function moduleAudit(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<AuditContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): AuditContribution {
  return {
    extensionId: `${moduleId}/audit/${localId}`,
    moduleId,
    localId,
    resourceId: options.resourceId,
    ...options,
  };
}

export function moduleJourney(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<JourneyContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): JourneyContribution {
  return {
    extensionId: `${moduleId}/journey/${localId}`,
    moduleId,
    localId,
    resourceId: options.resourceId ?? options.permissionResource,
    ...options,
  };
}

/** Notification Center contribution builder (Phase 41a foundation) — mirrors moduleJourney(). */
export function moduleNotification(
  moduleId: LicensedModuleId,
  localId: string,
  options: Omit<NotificationCenterContribution, 'extensionId' | 'localId' | 'moduleId' | 'resourceId'> & {
    resourceId?: string;
  },
): NotificationCenterContribution {
  return {
    extensionId: `${moduleId}/notification/${localId}`,
    moduleId,
    localId,
    resourceId: options.resourceId ?? options.permissionResource,
    ...options,
  };
}

/** @deprecated Use moduleWhiteLabel() with canonical vocabulary builders */
export function moduleWhiteLabelBranding(
  moduleId: LicensedModuleId,
  settingsPath: string,
): WhiteLabelContribution {
  return moduleWhiteLabel(moduleId, 'branding-core', {
    surfaceId: 'settings-branding-core',
    labelKey: 'modules.settings.whiteLabel.branding',
    sortOrder: 0,
    surface: 'branding',
    requiredFeature: 'customBranding',
    settingsPath,
    deepLinkTemplate: settingsPath,
    adminResourceId: 'api.settings',
    adminAction: 'update',
    appliesTo: ['appShell', 'pdf', 'email', 'export'],
    assetSlots: ['logo-light', 'logo-dark', 'favicon'],
    tokenGroups: ['color-primary', 'color-accent', 'color-surface'],
    categoryId: 'core-branding',
    defaultEnabled: true,
    rollbackBehavior: 'tenant-json',
    providerKey: 'whitelabel.builtin',
    schemaVersion: 1,
    resourceId: 'api.settings',
  });
}

export function capabilitiesFromExtensions(extensions: ModuleExtensionBundle): ModuleCapability[] {
  const caps: ModuleCapability[] = [];
  if (extensions.navigation?.length) caps.push('navigation');
  if (extensions.routing?.length) caps.push('routing');
  if (extensions.dashboard?.length) caps.push('dashboard');
  if (extensions.search?.length) caps.push('search');
  if (extensions.reporting?.length) caps.push('reporting');
  if (extensions.analytics?.length) caps.push('analytics');
  if (extensions.workflow?.length) caps.push('workflow');
  if (extensions.notifications?.length) caps.push('notifications');
  if (extensions.ai?.length) caps.push('ai');
  if (extensions.whiteLabel?.length) caps.push('whiteLabel');
  if (extensions.branch?.length) caps.push('branch');
  if (extensions.activity?.length) caps.push('activity');
  if (extensions.audit?.length) caps.push('audit');
  if (extensions.journey?.length) caps.push('journey');
  if (extensions.notification?.length) caps.push('notification');
  return caps;
}
