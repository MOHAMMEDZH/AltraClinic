import { getDashboardExportLabels } from '@booking/dashboard-export';
import { buildDashboardExcelBuffer } from '@booking/dashboard-export/excel';
import type { DashboardOverview } from '../api/dashboard-api';
import { triggerBrowserDownload } from '@/lib/download-file';

/** Download dashboard/analytics data as a styled Excel workbook (.xlsx). */
export async function downloadDashboardExcel(
  overview: DashboardOverview,
  title: string,
  locale: string,
  filenamePrefix = 'dashboard',
): Promise<void> {
  const labels = getDashboardExportLabels(locale, title);
  const buffer = await buildDashboardExcelBuffer(overview, labels, locale);
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBrowserDownload(blob, `${filenamePrefix}-${overview.generatedAt.slice(0, 10)}.xlsx`);
}
