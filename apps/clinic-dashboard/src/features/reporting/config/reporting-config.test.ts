import { describe, expect, it } from 'vitest';
import { REPORT_TEMPLATES, findTemplate, templatesForCategory } from '../config/reporting-catalog';
import {
  buildPermCheck,
  canCreateReports,
  canExportReports,
  canViewReporting,
  templateVisible,
} from '../config/reporting-config';
import { buildReportCategoryUrl, isReportCategoryId, parseReportCategoryParam } from '../lib/reporting-url';

describe('reporting-config', () => {
  it('allows owners to view and export reports', () => {
    const perm = buildPermCheck(['owner']);
    expect(canViewReporting(perm)).toBe(true);
    expect(canCreateReports(perm)).toBe(true);
    expect(canExportReports(perm)).toBe(true);
  });

  it('filters templates by permission', () => {
    const perm = buildPermCheck(['accountant']);
    const billing = findTemplate('billing-summary');
    expect(billing).toBeDefined();
    expect(templateVisible(billing!, perm)).toBe(true);
  });
});

describe('reporting-catalog', () => {
  it('has unique template ids', () => {
    const ids = REPORT_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns category templates', () => {
    expect(templatesForCategory('billing').every((t) => t.categoryId === 'billing')).toBe(true);
    expect(templatesForCategory('notifications').length).toBeGreaterThan(0);
    expect(isReportCategoryId('platform')).toBe(true);
  });
});

describe('reporting-url', () => {
  it('parses valid category ids', () => {
    expect(parseReportCategoryParam('billing')).toBe('billing');
    expect(parseReportCategoryParam('invalid')).toBeNull();
    expect(isReportCategoryId('staff')).toBe(true);
  });

  it('builds category urls', () => {
    expect(buildReportCategoryUrl('inventory')).toBe('/reports/category/inventory');
  });
});
