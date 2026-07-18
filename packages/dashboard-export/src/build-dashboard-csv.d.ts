import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
/** Build UTF-8 CSV text with section headers and localized labels. */
export declare function buildDashboardCsv(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string): string;
/** Prefix with UTF-8 BOM so Excel opens Arabic correctly. */
export declare function buildDashboardCsvWithBom(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string): string;
export declare function countDashboardExportRows(overview: DashboardOverviewForExport): number;
