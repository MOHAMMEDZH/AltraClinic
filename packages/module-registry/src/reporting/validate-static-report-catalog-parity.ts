import { CANONICAL_REPORT_HUBS } from './canonical-report-hubs';
import { CANONICAL_REPORT_TEMPLATES } from './canonical-report-templates';
import type { CanonicalReportTemplate } from './reporting-types';

/** Minimal static catalog entry shape for parity validation (Phase 33a). */
export interface StaticReportCatalogEntryLike {
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

const CANONICAL_ENTRIES: CanonicalReportTemplate[] = [...CANONICAL_REPORT_TEMPLATES, ...CANONICAL_REPORT_HUBS];

const CANONICAL_BY_EXTENSION_ID = new Map(
  CANONICAL_ENTRIES.map((entry) => [`${entry.moduleId}/reporting/${entry.reportId}`, entry]),
);

function compareOptionalField(
  errors: string[],
  reportId: string,
  field: string,
  actual: unknown,
  expected: unknown,
): void {
  if ((actual ?? null) !== (expected ?? null)) {
    errors.push(
      `Static catalog "${reportId}" ${field} mismatch: static=${String(actual ?? 'null')} canonical=${String(expected ?? 'null')}`,
    );
  }
}

function compareStringArrayField(
  errors: string[],
  reportId: string,
  field: string,
  actual: string[] | undefined,
  expected: string[] | undefined,
): void {
  const a = actual ?? [];
  const e = expected ?? [];
  if (a.length !== e.length || a.some((value, index) => value !== e[index])) {
    errors.push(`Static catalog "${reportId}" ${field} mismatch: static=[${a.join(',')}] canonical=[${e.join(',')}]`);
  }
}

/** Fail-closed field-by-field parity between STATIC_REPORT_CATALOG and canonical vocabulary. */
export function validateStaticReportCatalogParity(entries: StaticReportCatalogEntryLike[]): string[] {
  const errors: string[] = [];
  const seenExtensionIds = new Set<string>();
  const seenReportIds = new Set<string>();

  if (entries.length !== CANONICAL_ENTRIES.length) {
    errors.push(`Static catalog count mismatch: static=${entries.length} canonical=${CANONICAL_ENTRIES.length}`);
  }

  for (const entry of entries) {
    if (seenExtensionIds.has(entry.extensionId)) {
      errors.push(`Duplicate static catalog extensionId "${entry.extensionId}"`);
    }
    seenExtensionIds.add(entry.extensionId);

    if (seenReportIds.has(entry.reportId)) {
      errors.push(`Duplicate static catalog reportId "${entry.reportId}"`);
    }
    seenReportIds.add(entry.reportId);

    const canonical = CANONICAL_BY_EXTENSION_ID.get(entry.extensionId);
    if (!canonical) {
      errors.push(`Orphan static catalog entry "${entry.extensionId}" (no canonical entry)`);
      continue;
    }

    if (entry.localId !== entry.reportId || entry.localId !== canonical.reportId) {
      errors.push(`Static catalog "${entry.reportId}" localId must equal reportId`);
    }

    compareOptionalField(errors, entry.reportId, 'moduleId', entry.moduleId, canonical.moduleId);
    compareOptionalField(errors, entry.reportId, 'categoryKey', entry.categoryKey, canonical.categoryKey);
    compareOptionalField(errors, entry.reportId, 'dataDomain', entry.dataDomain, canonical.dataDomain);
    compareOptionalField(errors, entry.reportId, 'titleKey', entry.titleKey, canonical.titleKey);
    compareOptionalField(errors, entry.reportId, 'descriptionKey', entry.descriptionKey, canonical.descriptionKey);
    compareOptionalField(errors, entry.reportId, 'delivery', entry.delivery, canonical.delivery);
    compareOptionalField(errors, entry.reportId, 'route', entry.route, canonical.route);
    compareOptionalField(errors, entry.reportId, 'deepLinkTemplate', entry.deepLinkTemplate, canonical.deepLinkTemplate);
    compareOptionalField(errors, entry.reportId, 'permissionAction', entry.permissionAction, canonical.permissionAction);
    compareOptionalField(errors, entry.reportId, 'permissionResource', entry.permissionResource, canonical.permissionResource);
    compareOptionalField(errors, entry.reportId, 'featureId', entry.featureId, canonical.featureId);
    compareOptionalField(errors, entry.reportId, 'analyticsType', entry.analyticsType, canonical.analyticsType);
    compareOptionalField(errors, entry.reportId, 'operationalType', entry.operationalType, canonical.operationalType);
    compareOptionalField(errors, entry.reportId, 'defaultFormat', entry.defaultFormat, canonical.defaultFormat);
    compareOptionalField(errors, entry.reportId, 'scheduleAllowed', entry.scheduleAllowed, canonical.scheduleAllowed);
    compareOptionalField(errors, entry.reportId, 'providerKey', entry.providerKey, canonical.providerKey);
    compareOptionalField(errors, entry.reportId, 'sortOrder', entry.sortOrder, canonical.sortOrder);
    compareOptionalField(errors, entry.reportId, 'icon', entry.icon, canonical.icon);
    compareOptionalField(errors, entry.reportId, 'featured', entry.featured, canonical.featured);
    compareStringArrayField(errors, entry.reportId, 'permissionResources', entry.permissionResources, canonical.permissionResources);
    compareStringArrayField(errors, entry.reportId, 'supportedFormats', entry.supportedFormats, canonical.supportedFormats);
    compareStringArrayField(errors, entry.reportId, 'exportFormats', entry.exportFormats, canonical.exportFormats);
    compareStringArrayField(errors, entry.reportId, 'tags', entry.tags, canonical.tags);
  }

  for (const canonical of CANONICAL_ENTRIES) {
    const extensionId = `${canonical.moduleId}/reporting/${canonical.reportId}`;
    if (!seenExtensionIds.has(extensionId)) {
      errors.push(`Missing static catalog entry for canonical report "${canonical.reportId}"`);
    }
  }

  return errors;
}
