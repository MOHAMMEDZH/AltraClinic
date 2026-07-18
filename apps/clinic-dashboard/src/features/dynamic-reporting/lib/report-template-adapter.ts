import type { ReportTemplate } from '@/features/reporting/config/reporting-catalog';
import type { ReportSnapshot, ReportTemplateSnapshot } from './reporting-types';

export function snapshotTemplateToReportTemplate(template: ReportTemplateSnapshot): ReportTemplate {
  return {
    id: template.reportId,
    categoryId: template.categoryId,
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    delivery: template.delivery,
    route: template.route,
    analyticsType: template.analyticsType,
    defaultFormat: template.defaultFormat,
    supportedFormats: template.supportedFormats,
    permission: {
      resource: template.permissionResource,
      action: template.permissionAction,
    },
    featured: template.featured,
    tags: template.tags,
  };
}

export function findReportTemplateInSnapshot(
  snapshot: ReportSnapshot,
  reportId: string,
): ReportTemplate | undefined {
  const template = snapshot.templates.find((entry) => entry.reportId === reportId);
  return template ? snapshotTemplateToReportTemplate(template) : undefined;
}

export function snapshotTemplatesToReportTemplates(snapshot: ReportSnapshot): ReportTemplate[] {
  return snapshot.templates.map(snapshotTemplateToReportTemplate);
}
