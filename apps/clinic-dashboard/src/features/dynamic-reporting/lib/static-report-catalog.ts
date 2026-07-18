import { CANONICAL_REPORT_HUBS, CANONICAL_REPORT_TEMPLATES } from '@booking/module-registry/reporting';

export interface ReportCatalogEntry {
  extensionId: string;
  moduleId: string;
  localId: string;
  reportId: string;
  categoryKey: string;
  dataDomain: string;
  titleKey: string;
  descriptionKey: string;
  delivery: 'view' | 'generate' | 'export';
  route?: string;
  deepLinkTemplate: string;
  permissionAction: 'view' | 'create' | 'export';
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

function toEntry(t: (typeof CANONICAL_REPORT_TEMPLATES)[number]): ReportCatalogEntry {
  return {
    extensionId: `${t.moduleId}/reporting/${t.reportId}`,
    moduleId: t.moduleId,
    localId: t.reportId,
    reportId: t.reportId,
    categoryKey: t.categoryKey,
    dataDomain: t.dataDomain,
    titleKey: t.titleKey,
    descriptionKey: t.descriptionKey,
    delivery: t.delivery,
    route: t.route,
    deepLinkTemplate: t.deepLinkTemplate,
    permissionAction: t.permissionAction,
    permissionResource: t.permissionResource,
    permissionResources: t.permissionResources,
    featureId: t.featureId,
    analyticsType: t.analyticsType,
    operationalType: t.operationalType,
    defaultFormat: t.defaultFormat,
    supportedFormats: t.supportedFormats,
    exportFormats: t.exportFormats,
    scheduleAllowed: t.scheduleAllowed,
    providerKey: t.providerKey,
    sortOrder: t.sortOrder,
    icon: t.icon,
    featured: t.featured,
    tags: t.tags,
  };
}

/**
 * Authoritative static report catalog — generated from canonical registry vocabulary.
 * Parity baseline and rollback source for DynamicReportingProvider (Phases 33a+33b closed).
 */
export const STATIC_REPORT_CATALOG: ReportCatalogEntry[] = [
  ...CANONICAL_REPORT_TEMPLATES.map(toEntry),
  ...CANONICAL_REPORT_HUBS.map((hub) => toEntry(hub)),
];

