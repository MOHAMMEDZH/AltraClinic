import { describe, expect, it } from 'vitest';

import { createDemoOverview } from '../api/dashboard-api';

import { buildDashboardCsvContent } from './export-dashboard-csv';



describe('export-dashboard-csv', () => {

  it('includes localized KPI and trend sections with BOM', () => {

    const overview = createDemoOverview('7d');

    const csv = buildDashboardCsvContent(overview, 'en-US');



    expect(csv.startsWith('\uFEFF')).toBe(true);

    expect(csv).toContain('Key performance indicators');

    expect(csv).toContain('Revenue trend');

    expect(csv.split('\n').length).toBeGreaterThan(overview.revenueTrend.length + 10);

  });

});

