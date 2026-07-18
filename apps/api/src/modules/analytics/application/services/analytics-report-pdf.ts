import type { DashboardOverviewDto } from '../../../dashboard/application/dashboard-overview.service';

import {

  buildDashboardPdfBytes,

  getDashboardExportLabels,

  loadArabicFontAssets,

} from '@booking/dashboard-export/node';



export interface ReportPdfBranding {
  clinicName?: string;
  logoBytes?: Uint8Array;
  logoMimeType?: string;
}



export async function buildAnalyticsReportPdf(

  overview: DashboardOverviewDto,

  title: string,

  locale = 'en-US',

  branding?: ReportPdfBranding,

): Promise<Uint8Array> {

  const labels = getDashboardExportLabels(locale, title);

  const fonts = locale.startsWith('ar') ? loadArabicFontAssets() : undefined;

  return buildDashboardPdfBytes(overview, labels, locale, fonts ?? undefined, branding);

}

