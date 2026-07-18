import type { EffectiveModuleView } from '@booking/module-registry';
import type {
  ReportCatalogEntry,
  ReportingCapabilities,
  ReportingContributionView,
  ReportHubSnapshot,
  ReportSnapshot,
  ReportTemplateSnapshot,
} from './reporting-types';

interface ReportingExtensionPayload {
  reportId?: string;
  categoryKey?: string;
  dataDomain?: string;
  delivery?: 'view' | 'generate' | 'export';
  route?: string;
  deepLinkTemplate?: string;
  permissionAction?: 'view' | 'create' | 'export';
  permissionResource?: string;
  permissionResources?: string[];
  featureId?: string;
  analyticsType?: string;
  operationalType?: string;
  providerKey?: string;
  sortOrder?: number;
  userAccessible?: boolean;
}

const HUB_REPORT_IDS = new Set(['catalog', 'builder', 'export-center']);

function normalizePermissionResource(payload: ReportingExtensionPayload): string {
  if (payload.permissionResource) return payload.permissionResource;
  if (payload.permissionResources?.length) return payload.permissionResources[0];
  return '';
}

/**
 * Extracts reporting contributions from EffectiveModuleView only.
 * No manifest reads — server-side RBAC/licensing already applied.
 */
export function extractReportingContributions(modules: EffectiveModuleView[]): ReportingContributionView[] {
  const contributions: ReportingContributionView[] = [];

  for (const module of modules) {
    for (const extension of module.extensions) {
      if (extension.kind !== 'reporting') continue;

      const payload = extension.payload as ReportingExtensionPayload;
      if (!payload.reportId || !payload.categoryKey || !payload.deepLinkTemplate) continue;

      contributions.push({
        extensionId: extension.extensionId,
        moduleId: module.moduleId,
        reportId: payload.reportId,
        categoryKey: payload.categoryKey,
        dataDomain: payload.dataDomain ?? payload.reportId,
        labelKey: extension.labelKey,
        delivery: payload.delivery ?? 'view',
        route: payload.route,
        deepLinkTemplate: payload.deepLinkTemplate,
        permissionAction: payload.permissionAction ?? 'view',
        permissionResource: normalizePermissionResource(payload),
        permissionResources: payload.permissionResources,
        featureId: payload.featureId,
        analyticsType: payload.analyticsType,
        operationalType: payload.operationalType,
        providerKey: payload.providerKey ?? 'reporting.builtin',
        sortOrder: payload.sortOrder ?? extension.sortOrder,
        userVisible: extension.userVisible,
        userAccessible:
          typeof payload.userAccessible === 'boolean'
            ? payload.userAccessible
            : module.userAccessible && extension.userVisible,
      });
    }
  }

  return contributions.sort(
    (a, b) => a.sortOrder - b.sortOrder || a.extensionId.localeCompare(b.extensionId),
  );
}

export function resolveAccessibleModuleIds(modules: EffectiveModuleView[]): Set<string> {
  const ids = new Set<string>();
  for (const module of modules) {
    if (module.userAccessible) {
      ids.add(module.moduleId);
    }
  }
  return ids;
}

function isExtensionAccessible(contribution: ReportingContributionView): boolean {
  return contribution.userVisible && contribution.userAccessible;
}

export function isCatalogReportEntryIncluded(
  entry: ReportCatalogEntry,
  modules: EffectiveModuleView[],
  contributions: ReportingContributionView[],
): boolean {
  const contribution = contributions.find((item) => item.extensionId === entry.extensionId);
  if (!contribution) return false;
  if (!isExtensionAccessible(contribution)) return false;

  const moduleView = modules.find((module) => module.moduleId === entry.moduleId);
  if (!moduleView?.userVisible) return false;

  return true;
}

export function isHubReportId(reportId: string): boolean {
  return HUB_REPORT_IDS.has(reportId);
}

export function resolveReportingCapabilities(snapshot: {
  templates: ReportTemplateSnapshot[];
  hubEntries: ReportHubSnapshot[];
}): ReportingCapabilities {
  const accessibleEntries = [...snapshot.templates, ...snapshot.hubEntries];

  const hasAction = (action: ReportTemplateSnapshot['permissionAction']) =>
    accessibleEntries.some((entry) => entry.permissionAction === action);

  return {
    canViewReporting: accessibleEntries.length > 0,
    canCreateReports: snapshot.templates.some(
      (template) => template.delivery === 'generate' && template.permissionAction === 'create',
    ),
    canExportReports:
      hasAction('export') || accessibleEntries.some((entry) => entry.delivery === 'export'),
  };
}

export function resolveReportingCapabilitiesFromSnapshot(snapshot: ReportSnapshot): ReportingCapabilities {
  return {
    canViewReporting: snapshot.canViewReporting,
    canCreateReports: snapshot.canCreateReports,
    canExportReports: snapshot.canExportReports,
  };
}
