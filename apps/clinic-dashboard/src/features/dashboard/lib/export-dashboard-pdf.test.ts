import { describe, expect, it } from 'vitest';
import { createDemoOverview } from '../api/dashboard-api';
import { buildDashboardExportDocument, getDashboardExportLabels } from '@booking/dashboard-export';
import { buildDashboardPdfBytes } from '@booking/dashboard-export/pdf';

describe('export-dashboard-pdf', () => {
  it('builds a structured export document with KPI and health sections', () => {
    const overview = createDemoOverview('7d');
    const labels = getDashboardExportLabels('en-US', 'Dashboard');
    const doc = buildDashboardExportDocument(overview, labels, 'en-US');

    expect(doc.title).toBe('Dashboard');
    expect(doc.sections.some((section) => section.title === labels.kpisSection)).toBe(true);
    expect(doc.sections.some((section) => section.title === labels.healthSection)).toBe(true);
  });

  it('builds a styled PDF buffer', async () => {
    const overview = createDemoOverview('7d');
    const labels = getDashboardExportLabels('en-US', 'Dashboard');
    const bytes = await buildDashboardPdfBytes(overview, labels, 'en-US');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
  });
});
