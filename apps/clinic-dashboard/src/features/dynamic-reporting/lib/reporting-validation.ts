import { BUILTIN_MODULE_MANIFESTS } from '@booking/module-registry';
import { validateReportingLayerParity } from '@booking/module-registry/reporting';
import type { ReportSnapshot } from './reporting-types';
import { STATIC_REPORT_CATALOG } from './static-report-catalog';

export function assertReportingCatalogValid(catalog = STATIC_REPORT_CATALOG): string[] {
  return validateReportingLayerParity(BUILTIN_MODULE_MANIFESTS, catalog);
}

export function assertReportingSnapshotValid(snapshot: ReportSnapshot): string[] {
  const errors: string[] = [];
  const seenReportIds = new Set<string>();

  for (const template of snapshot.templates) {
    if (seenReportIds.has(template.reportId)) {
      errors.push(`Duplicate template reportId in snapshot: ${template.reportId}`);
    }
    seenReportIds.add(template.reportId);

    const catalogEntry = STATIC_REPORT_CATALOG.find((entry) => entry.extensionId === template.extensionId);
    if (!catalogEntry) {
      errors.push(`Snapshot template missing catalog match: ${template.extensionId}`);
    }
  }

  for (const hub of snapshot.hubEntries) {
    if (seenReportIds.has(hub.reportId)) {
      errors.push(`Duplicate hub reportId in snapshot: ${hub.reportId}`);
    }
    seenReportIds.add(hub.reportId);
  }

  if (snapshot.canViewReporting !== [...snapshot.templates, ...snapshot.hubEntries].length > 0) {
    errors.push('Snapshot canViewReporting flag mismatch');
  }

  for (const template of snapshot.templates) {
    if (!snapshot.deepLinkByReportId[template.reportId]) {
      errors.push(`Missing deepLinkByReportId for ${template.reportId}`);
    }
    if (!snapshot.labelKeyByReportId[template.reportId]) {
      errors.push(`Missing labelKeyByReportId for ${template.reportId}`);
    }
  }

  return errors;
}

export function assertReportingCatalogLoaded(): void {
  const errors = assertReportingCatalogValid();
  if (errors.length > 0) {
    throw new Error(`Invalid static report catalog:\n${errors.join('\n')}`);
  }
}
