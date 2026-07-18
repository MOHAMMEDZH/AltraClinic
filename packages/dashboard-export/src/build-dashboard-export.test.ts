import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { getDashboardExportLabels } from './labels';
import { buildDashboardCsvWithBom, countDashboardExportRows } from './build-dashboard-csv';
import { buildDashboardExcelBuffer } from './build-dashboard-excel';
import { buildDashboardPdfBytes } from './build-dashboard-pdf';
import { buildDashboardWordBuffer } from './build-dashboard-word';

const overview = {
  generatedAt: '2026-06-15T12:00:00.000Z',
  kpis: {
    totalPatients: 120,
    appointmentsToday: 12,
    queueWaiting: 2,
    revenueToday: 1500,
    revenueMonth: 42000,
    outstandingAmount: 800,
    lowStockCount: 1,
  },
  businessHealth: {
    utilizationPercent: 72,
    collectionPercent: 88,
    noShowPercent: 6,
  },
  revenueTrend: [
    { date: '2026-06-13', amount: 900 },
    { date: '2026-06-14', amount: 1100 },
  ],
  appointmentTrend: [{ date: '2026-06-14', count: 8 }],
  patientGrowthTrend: [{ date: '2026-06-14', count: 3 }],
  branchPerformance: [{ name: 'Main', nameAr: 'الرئيسي', appointments: 10, revenue: 5000 }],
  doctorPerformance: [
    {
      firstName: 'Sam',
      lastName: 'Hassan',
      firstNameAr: 'سام',
      lastNameAr: 'حسن',
      appointments: 5,
      encounters: 4,
    },
  ],
};

describe('dashboard-export', () => {
  it('builds localized CSV with BOM and sections', () => {
    const labels = getDashboardExportLabels('ar-SY', 'التحليلات');
    const csv = buildDashboardCsvWithBom(overview, labels, 'ar-SY');
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('مؤشرات الأداء الرئيسية');
    expect(csv).toContain('الرئيسي');
  });

  it('builds Excel buffer with content', async () => {
    const labels = getDashboardExportLabels('en-US', 'Analytics');
    const buffer = await buildDashboardExcelBuffer(overview, labels, 'en-US');
    expect(buffer.byteLength).toBeGreaterThan(1000);
  });

  it('builds PDF buffer with content', async () => {
    const labels = getDashboardExportLabels('en-US', 'Analytics');
    const bytes = await buildDashboardPdfBytes(overview, labels, 'en-US');
    expect(bytes.byteLength).toBeGreaterThan(1000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
  });

  it('builds Word buffer with content', async () => {
    const labels = getDashboardExportLabels('ar-SY', 'التحليلات');
    const buffer = await buildDashboardWordBuffer(overview, labels, 'ar-SY');
    expect(buffer.byteLength).toBeGreaterThan(1000);
    const header = String.fromCharCode(...new Uint8Array(buffer.slice(0, 2)));
    expect(header).toBe('PK');
  });

  it('builds Arabic PDF with shaped text and Naskh fonts', async () => {
    const assetsDir = join(__dirname, '..', 'assets');
    const fonts = {
      arabicRegular: readFileSync(join(assetsDir, 'NotoNaskhArabic-Regular.ttf')),
      arabicBold: readFileSync(join(assetsDir, 'NotoNaskhArabic-Bold.ttf')),
    };
    const labels = getDashboardExportLabels('ar-SY', 'التحليلات');
    const bytes = await buildDashboardPdfBytes(overview, labels, 'ar-SY', fonts);
    expect(bytes.byteLength).toBeGreaterThan(5000);
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('%PDF');
  });

  it('counts export rows', () => {
    expect(countDashboardExportRows(overview)).toBe(15);
  });
});
