import { getDashboardExportLabels } from '@booking/dashboard-export';
import { buildDashboardPdfBytes } from '@booking/dashboard-export/pdf';
import type { DashboardOverview } from '../api/dashboard-api';
import { triggerBrowserDownload } from '@/lib/download-file';

async function loadBrowserArabicFonts(): Promise<{
  arabicRegular: ArrayBuffer;
  arabicBold: ArrayBuffer;
} | null> {
  const pairs = [
    ['NotoNaskhArabic-Regular.ttf', 'NotoNaskhArabic-Bold.ttf'],
    ['NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf'],
  ] as const;

  for (const [regularName, boldName] of pairs) {
    try {
      const [regularResp, boldResp] = await Promise.all([
        fetch(`/fonts/${regularName}`),
        fetch(`/fonts/${boldName}`),
      ]);
      if (!regularResp.ok || !boldResp.ok) continue;
      return {
        arabicRegular: await regularResp.arrayBuffer(),
        arabicBold: await boldResp.arrayBuffer(),
      };
    } catch {
      continue;
    }
  }
  return null;
}

/** Download dashboard/analytics data as a styled PDF matching the Excel export. */
export async function downloadDashboardPdf(
  overview: DashboardOverview,
  title: string,
  locale: string,
  filenamePrefix = 'dashboard',
): Promise<void> {
  const labels = getDashboardExportLabels(locale, title);
  const fonts = await loadBrowserArabicFonts();
  if (locale.startsWith('ar') && !fonts) {
    throw new Error('Arabic fonts could not be loaded. Refresh the page and try again.');
  }

  const bytes = await buildDashboardPdfBytes(
    overview,
    labels,
    locale,
    fonts
      ? {
          arabicRegular: fonts.arabicRegular,
          arabicBold: fonts.arabicBold,
        }
      : undefined,
  );

  triggerBrowserDownload(
    new Blob([bytes], { type: 'application/pdf' }),
    `${filenamePrefix}-${overview.generatedAt.slice(0, 10)}.pdf`,
  );
}

/** @deprecated Use downloadDashboardPdf. */
export function printDashboardReport(
  overview: DashboardOverview,
  title: string,
  locale = 'en-US',
): void {
  void downloadDashboardPdf(overview, title, locale);
}
