import type { DashboardOverviewDto } from '../../../dashboard/application/dashboard-overview.service';

import {

  buildDashboardCsvWithBom,

  buildDashboardExcelBuffer,

  countDashboardExportRows,

  getDashboardExportLabels,

} from '@booking/dashboard-export/node';



function resolveLocale(parameters?: Record<string, unknown>): string {

  const locale = parameters?.locale;

  return typeof locale === 'string' ? locale : 'en-US';

}



export function buildAnalyticsReportCsv(

  overview: DashboardOverviewDto,

  reportName = 'Analytics report',

  locale = 'en-US',

): string {

  const labels = getDashboardExportLabels(locale, reportName);

  return buildDashboardCsvWithBom(overview, labels, locale);

}



export async function buildAnalyticsReportExcel(

  overview: DashboardOverviewDto,

  reportName: string,

  locale: string,

): Promise<Buffer> {

  const labels = getDashboardExportLabels(locale, reportName);

  const buffer = await buildDashboardExcelBuffer(overview, labels, locale);

  return Buffer.from(buffer);

}



export function countAnalyticsReportRows(overview: DashboardOverviewDto): number {

  return countDashboardExportRows(overview);

}



export { resolveLocale as resolveReportExportLocale };

