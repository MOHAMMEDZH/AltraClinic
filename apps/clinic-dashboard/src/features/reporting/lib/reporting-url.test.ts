import { describe, expect, it } from 'vitest';
import { buildReportCategoryUrl, isReportCategoryId } from './reporting-url';

describe('reporting-url', () => {
  it('builds category urls', () => {
    expect(buildReportCategoryUrl('billing')).toBe('/reports/category/billing');
    expect(isReportCategoryId('staff')).toBe(true);
    expect(isReportCategoryId('invalid')).toBe(false);
  });
});
