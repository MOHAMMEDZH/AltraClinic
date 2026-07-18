import { STATIC_REPORT_CATALOG } from './lib/static-report-catalog';
import { describe, expect, it } from 'vitest';
import { validateStaticReportCatalogParity } from '@booking/module-registry/reporting';

describe('STATIC_REPORT_CATALOG (Phase 33a)', () => {
  it('is stable and non-empty', () => {
    expect(STATIC_REPORT_CATALOG.length).toBe(43);
  });

  it('contains unique extensionIds and reportIds', () => {
    const extensionIds = STATIC_REPORT_CATALOG.map((e) => e.extensionId);
    const reportIds = STATIC_REPORT_CATALOG.map((e) => e.reportId);
    expect(new Set(extensionIds).size).toBe(extensionIds.length);
    expect(new Set(reportIds).size).toBe(reportIds.length);
  });

  it('every entry has permission metadata and deep links', () => {
    for (const entry of STATIC_REPORT_CATALOG) {
      expect(entry.permissionResource).toMatch(/^api\./);
      expect(['view', 'create', 'export']).toContain(entry.permissionAction);
      expect(entry.deepLinkTemplate.startsWith('/')).toBe(true);
      expect(entry.providerKey.length).toBeGreaterThan(0);
      expect(entry.categoryKey.length).toBeGreaterThan(0);
      expect(entry.dataDomain.length).toBeGreaterThan(0);
    }
  });

  it('matches canonical reporting vocabulary field-by-field', () => {
    expect(validateStaticReportCatalogParity(STATIC_REPORT_CATALOG)).toEqual([]);
  });
});
