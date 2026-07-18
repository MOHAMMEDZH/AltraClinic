import { getDashboardExportLabels } from '@booking/dashboard-export';
import { buildDashboardWordBuffer } from '@booking/dashboard-export/word';
import type { DashboardOverview } from '../api/dashboard-api';
import { triggerBrowserDownload } from '@/lib/download-file';

/** Download dashboard/analytics data as a styled Word document (.docx) with native Arabic RTL. */
export async function downloadDashboardWord(
  overview: DashboardOverview,
  title: string,
  locale: string,
  filenamePrefix = 'dashboard',
): Promise<void> {
  const labels = getDashboardExportLabels(locale, title);
  const buffer = await buildDashboardWordBuffer(overview, labels, locale);
  triggerBrowserDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    }),
    `${filenamePrefix}-${overview.generatedAt.slice(0, 10)}.docx`,
  );
}
