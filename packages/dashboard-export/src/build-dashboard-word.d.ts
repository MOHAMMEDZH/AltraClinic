import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
/** Build a styled Word document (.docx) with native RTL Arabic support. */
export declare function buildDashboardWordBuffer(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string): Promise<ArrayBuffer>;
