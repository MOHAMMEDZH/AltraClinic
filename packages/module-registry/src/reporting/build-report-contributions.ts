import type { LicensedModuleId, ReportingContribution } from '../types';
import { moduleReport } from '../builtin/extension-builders';
import { CANONICAL_REPORT_HUBS } from './canonical-report-hubs';
import { CANONICAL_REPORT_TEMPLATES } from './canonical-report-templates';
import type { CanonicalReportTemplate } from './reporting-types';

function toContribution(template: CanonicalReportTemplate): ReportingContribution {
  return moduleReport(
    template.moduleId,
    template.reportId,
    template.categoryKey,
    template.dataDomain,
    template.titleKey,
    template.permissionResource,
    {
      sortOrder: template.sortOrder,
      delivery: template.delivery,
      route: template.route,
      deepLinkTemplate: template.deepLinkTemplate,
      permissionAction: template.permissionAction,
      permissionResource: template.permissionResource,
      permissionResources: template.permissionResources,
      featureId: template.featureId,
      analyticsType: template.analyticsType,
      operationalType: template.operationalType,
      defaultFormat: template.defaultFormat,
      supportedFormats: template.supportedFormats,
      exportFormats: template.exportFormats,
      scheduleAllowed: template.scheduleAllowed,
      providerKey: template.providerKey,
      icon: template.icon,
      descriptionKey: template.descriptionKey,
      featured: template.featured,
      tags: template.tags,
    },
  );
}

export function buildReportingContributionsForModule(moduleId: LicensedModuleId): ReportingContribution[] {
  const templates = CANONICAL_REPORT_TEMPLATES.filter((t) => t.moduleId === moduleId).map(toContribution);
  const hubs = CANONICAL_REPORT_HUBS.filter((t) => t.moduleId === moduleId).map(toContribution);
  return [...templates, ...hubs];
}

