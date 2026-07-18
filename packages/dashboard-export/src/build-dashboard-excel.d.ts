import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
/** Build a styled Excel workbook buffer with section colors and RTL Arabic support. */
export declare function buildDashboardExcelBuffer(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string): Promise<ArrayBuffer>;
