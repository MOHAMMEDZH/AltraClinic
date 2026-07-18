import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
export interface DashboardPdfFontBundle {
    arabicRegular?: Uint8Array | ArrayBuffer;
    arabicBold?: Uint8Array | ArrayBuffer;
}
export interface DashboardPdfBranding {
    clinicName?: string;
    logoBytes?: Uint8Array;
    logoMimeType?: string;
}
/** Build a styled PDF report matching the Excel export layout. */
export declare function buildDashboardPdfBytes(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string, fonts?: DashboardPdfFontBundle, branding?: DashboardPdfBranding): Promise<Uint8Array>;
