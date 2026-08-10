import type { LicensedModuleId } from '@booking/module-registry';
import { hasPermission } from '@booking/permissions';
import type { EffectiveModuleView } from '@booking/module-registry';
import type { ReportCategoryId } from '@/features/reporting/config/reporting-catalog';
import type { GenerateAnalyticsReportInput } from '@/features/analytics/api/analytics-api';
import {
  extractReportingContributions,
  isCatalogReportEntryIncluded,
  isHubReportId,
  resolveAccessibleModuleIds,
  resolveReportingCapabilities,
} from './reporting-resolver';
import type {
  ReportCatalogEntry,
  ReportCatalogSource,
  ReportCategorySnapshot,
  ReportHubSnapshot,
  ReportSnapshot,
  ReportSnapshotIdentity,
  ReportTemplateSnapshot,
} from './reporting-types';

export interface BuildReportingSnapshotOptions {
  roles: string[];
  catalog: readonly ReportCatalogEntry[];
  modules: EffectiveModuleView[];
  source: ReportCatalogSource;
  catalogGeneration: number | null;
  entitlementVersion: string | null;
  identity: ReportSnapshotIdentity;
  includeAllPermitted?: boolean;
}

function parseCategoryId(categoryKey: string): ReportCategoryId | null {
  if (!categoryKey.startsWith('reports.')) return null;
  return categoryKey.slice('reports.'.length) as ReportCategoryId;
}

function toTemplateSnapshot(entry: ReportCatalogEntry): ReportTemplateSnapshot | null {
  const categoryId = parseCategoryId(entry.categoryKey);
  if (!categoryId) return null;

  return {
    kind: 'template',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    reportId: entry.reportId,
    categoryId,
    categoryKey: entry.categoryKey,
    dataDomain: entry.dataDomain,
    titleKey: entry.titleKey,
    descriptionKey: entry.descriptionKey,
    delivery: entry.delivery,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    permissionAction: entry.permissionAction,
    permissionResource: entry.permissionResource,
    permissionResources: entry.permissionResources,
    featureId: entry.featureId,
    analyticsType: entry.analyticsType as GenerateAnalyticsReportInput['reportType'] | undefined,
    operationalType: entry.operationalType,
    defaultFormat: entry.defaultFormat as GenerateAnalyticsReportInput['format'] | undefined,
    supportedFormats: entry.supportedFormats as GenerateAnalyticsReportInput['format'][] | undefined,
    exportFormats: entry.exportFormats,
    scheduleAllowed: entry.scheduleAllowed,
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
    icon: entry.icon,
    featured: entry.featured,
    tags: entry.tags,
  };
}

function toHubSnapshot(entry: ReportCatalogEntry): ReportHubSnapshot {
  return {
    kind: 'hub',
    extensionId: entry.extensionId,
    moduleId: entry.moduleId as LicensedModuleId,
    reportId: entry.reportId,
    categoryKey: entry.categoryKey,
    dataDomain: entry.dataDomain,
    titleKey: entry.titleKey,
    descriptionKey: entry.descriptionKey,
    delivery: entry.delivery,
    route: entry.route,
    deepLinkTemplate: entry.deepLinkTemplate,
    permissionAction: entry.permissionAction,
    permissionResource: entry.permissionResource,
    permissionResources: entry.permissionResources,
    featureId: entry.featureId,
    providerKey: entry.providerKey,
    sortOrder: entry.sortOrder,
  };
}

function sortTemplates(entries: ReportTemplateSnapshot[]): ReportTemplateSnapshot[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.reportId.localeCompare(b.reportId),
  );
}

function sortHubs(entries: ReportHubSnapshot[]): ReportHubSnapshot[] {
  return [...entries].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.reportId.localeCompare(b.reportId),
  );
}

function buildLookupMaps(
  templates: ReportTemplateSnapshot[],
  hubs: ReportHubSnapshot[],
): Pick<ReportSnapshot, 'deepLinkByReportId' | 'labelKeyByReportId' | 'providerKeyByReportId'> {
  const deepLinkByReportId: Record<string, string> = {};
  const labelKeyByReportId: Record<string, string> = {};
  const providerKeyByReportId: Record<string, string> = {};

  for (const entry of [...templates, ...hubs]) {
    deepLinkByReportId[entry.reportId] = entry.deepLinkTemplate;
    labelKeyByReportId[entry.reportId] = entry.titleKey;
    providerKeyByReportId[entry.reportId] = entry.providerKey;
  }

  return { deepLinkByReportId, labelKeyByReportId, providerKeyByReportId };
}

function buildCategories(templates: ReportTemplateSnapshot[]): ReportCategorySnapshot[] {
  const counts = new Map<ReportCategoryId, number>();
  for (const template of templates) {
    counts.set(template.categoryId, (counts.get(template.categoryId) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([categoryId, templateCount]) => ({
      categoryId,
      labelKey: `reports.categories.${categoryId}`,
      templateCount,
    }));
}

function buildTemplatesByCategory(
  templates: ReportTemplateSnapshot[],
): Partial<Record<ReportCategoryId, ReportTemplateSnapshot[]>> {
  const grouped: Partial<Record<ReportCategoryId, ReportTemplateSnapshot[]>> = {};
  for (const template of templates) {
    const list = grouped[template.categoryId] ?? [];
    list.push(template);
    grouped[template.categoryId] = list;
  }
  return grouped;
}

function filterStaticEntries(catalog: readonly ReportCatalogEntry[], roles: string[]): ReportCatalogEntry[] {
  return catalog.filter((entry) =>
    hasPermission(roles, entry.permissionResource as never, entry.permissionAction as never),
  );
}

function filterRegistryEntries(
  catalog: readonly ReportCatalogEntry[],
  modules: EffectiveModuleView[],
  contributions: ReturnType<typeof extractReportingContributions>,
): ReportCatalogEntry[] {
  return catalog.filter((entry) => isCatalogReportEntryIncluded(entry, modules, contributions));
}

export function buildReportingSnapshot(options: BuildReportingSnapshotOptions): ReportSnapshot {
  const contributions = extractReportingContributions(options.modules);
  const includedCatalog = options.includeAllPermitted
    ? filterStaticEntries(options.catalog, options.roles)
    : filterRegistryEntries(options.catalog, options.modules, contributions);

  const templates = sortTemplates(
    includedCatalog
      .filter((entry) => !isHubReportId(entry.reportId))
      .map(toTemplateSnapshot)
      .filter((entry): entry is ReportTemplateSnapshot => Boolean(entry)),
  );

  const hubEntries = sortHubs(
    includedCatalog.filter((entry) => isHubReportId(entry.reportId)).map(toHubSnapshot),
  );

  const capabilities = resolveReportingCapabilities({ templates, hubEntries });
  const enabledModuleIds = options.includeAllPermitted
    ? [...new Set([...templates, ...hubEntries].map((entry) => entry.moduleId))].sort()
    : [...resolveAccessibleModuleIds(options.modules)].sort();

  const lookups = buildLookupMaps(templates, hubEntries);

  return {
    source: options.source,
    catalogGeneration: options.catalogGeneration,
    entitlementVersion: options.entitlementVersion,
    identity: options.identity,
    categories: buildCategories(templates),
    templates,
    hubEntries,
    templatesByCategory: buildTemplatesByCategory(templates),
    featuredTemplates: templates.filter((template) => template.featured),
    enabledModuleIds,
    ...lookups,
    ...capabilities,
  };
}

export function buildRegistryReportingSnapshot(
  roles: string[],
  catalog: readonly ReportCatalogEntry[],
  modules: EffectiveModuleView[],
  catalogGeneration: number | null,
  entitlementVersion: string | null,
  identity: ReportSnapshotIdentity,
): ReportSnapshot {
  return buildReportingSnapshot({
    roles,
    catalog,
    modules,
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    includeAllPermitted: false,
  });
}

export function buildStaticReportingSnapshot(
  roles: string[],
  catalog: readonly ReportCatalogEntry[],
  identity: ReportSnapshotIdentity,
  source: Extract<ReportCatalogSource, 'static-fallback' | 'static-only'> = 'static-only',
): ReportSnapshot {
  return buildReportingSnapshot({
    roles,
    catalog,
    modules: [],
    source,
    catalogGeneration: null,
    entitlementVersion: null,
    identity,
    includeAllPermitted: true,
  });
}

/** Fail-closed registry placeholder while bootstrap resolves — never widens reporting surface. */
export function buildRestrictedReportSnapshot(
  identity: ReportSnapshotIdentity,
  catalogGeneration: number | null = null,
  entitlementVersion: string | null = null,
): ReportSnapshot {
  return {
    source: 'registry',
    catalogGeneration,
    entitlementVersion,
    identity,
    categories: [],
    templates: [],
    hubEntries: [],
    templatesByCategory: {},
    featuredTemplates: [],
    enabledModuleIds: [],
    deepLinkByReportId: {},
    labelKeyByReportId: {},
    providerKeyByReportId: {},
    canViewReporting: false,
    canCreateReports: false,
    canExportReports: false,
  };
}

export function getSnapshotTemplateByReportId(
  snapshot: ReportSnapshot,
  reportId: string,
): ReportTemplateSnapshot | undefined {
  return snapshot.templates.find((template) => template.reportId === reportId);
}
