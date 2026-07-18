import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
export interface ExportMetricSection {
    kind: 'metrics';
    title: string;
    rows: Array<[string, string]>;
}
export interface ExportTableSection {
    kind: 'table';
    title: string;
    headers: string[];
    rows: string[][];
}
export type DashboardExportSection = ExportMetricSection | ExportTableSection;
export interface DashboardExportDocument {
    title: string;
    subtitle: string;
    /** When set, PDF renderer draws label (Arabic) and value (Latin) separately. */
    subtitleParts?: {
        label: string;
        value: string;
    };
    sections: DashboardExportSection[];
}
export interface BuildDashboardExportOptions {
    forPdf?: boolean;
}
/** Build structured export sections shared by Excel and PDF renderers. */
export declare function buildDashboardExportDocument(overview: DashboardOverviewForExport, labels: DashboardExportLabels, locale: string, options?: BuildDashboardExportOptions): DashboardExportDocument;
