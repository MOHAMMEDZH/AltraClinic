import type { DashboardOverview } from '../api/dashboard-api';

import {

  buildDashboardCsvWithBom,

  getDashboardExportLabels,

} from '@booking/dashboard-export';



/** @deprecated Use downloadDashboardExcel for styled exports with Arabic support. */

export function buildDashboardCsvContent(overview: DashboardOverview, locale = 'en-US'): string {

  const labels = getDashboardExportLabels(locale, 'Dashboard');

  return buildDashboardCsvWithBom(overview, labels, locale);

}



/** @deprecated Use downloadDashboardExcel. */

export function downloadDashboardCsv(

  overview: DashboardOverview,

  filenamePrefix = 'dashboard',

  locale = 'en-US',

): void {

  const blob = new Blob([buildDashboardCsvContent(overview, locale)], {

    type: 'text/csv;charset=utf-8',

  });

  const url = URL.createObjectURL(blob);

  const anchor = document.createElement('a');

  anchor.href = url;

  anchor.download = `${filenamePrefix}-${overview.generatedAt.slice(0, 10)}.csv`;

  anchor.click();

  URL.revokeObjectURL(url);

}

