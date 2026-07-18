import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
import {
  formatExportCurrency,
  formatExportCurrencyForPdf,
  formatExportDate,
  formatExportDateForPdf,
  formatExportDateTime,
  formatExportDateTimeForPdf,
  formatExportNumber,
  formatExportNumberForPdf,
  formatExportPercent,
  formatExportPercentForPdf,
  formatExportPersonName,
  pickLocalizedExportName,
} from './format';

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
  subtitleParts?: { label: string; value: string };
  sections: DashboardExportSection[];
}

export interface BuildDashboardExportOptions {
  forPdf?: boolean;
}

/** Build structured export sections shared by Excel and PDF renderers. */
export function buildDashboardExportDocument(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
  options?: BuildDashboardExportOptions,
): DashboardExportDocument {
  const forPdf = options?.forPdf === true;
  const fmtNum = (value: number) =>
    forPdf ? formatExportNumberForPdf(value, locale) : formatExportNumber(value, locale);
  const fmtCur = (amount: number) =>
    forPdf ? formatExportCurrencyForPdf(amount, locale) : formatExportCurrency(amount, locale);
  const fmtPct = (value: number) =>
    forPdf ? formatExportPercentForPdf(value, locale) : formatExportPercent(value, locale);
  const fmtDate = (iso: string) =>
    forPdf ? formatExportDateForPdf(iso, locale) : formatExportDate(iso, locale);

  const { kpis, businessHealth } = overview;

  const sections: DashboardExportSection[] = [
    {
      kind: 'metrics',
      title: labels.kpisSection,
      rows: [
        [labels.totalPatients, fmtNum(kpis.totalPatients)],
        [labels.appointmentsToday, fmtNum(kpis.appointmentsToday)],
        [labels.queueWaiting, fmtNum(kpis.queueWaiting)],
        [labels.revenueToday, fmtCur(kpis.revenueToday)],
        [labels.revenueMonth, fmtCur(kpis.revenueMonth)],
        [labels.outstandingAmount, fmtCur(kpis.outstandingAmount)],
        [labels.lowStockCount, fmtNum(kpis.lowStockCount)],
      ],
    },
    {
      kind: 'metrics',
      title: labels.healthSection,
      rows: [
        [labels.utilization, fmtPct(businessHealth.utilizationPercent)],
        [labels.collection, fmtPct(businessHealth.collectionPercent)],
        [labels.noShow, fmtPct(businessHealth.noShowPercent)],
      ],
    },
    {
      kind: 'table',
      title: labels.revenueTrendSection,
      headers: [labels.date, labels.amount],
      rows: overview.revenueTrend.map((point) => [fmtDate(point.date), fmtCur(point.amount)]),
    },
    {
      kind: 'table',
      title: labels.appointmentTrendSection,
      headers: [labels.date, labels.count],
      rows: overview.appointmentTrend.map((point) => [fmtDate(point.date), fmtNum(point.count)]),
    },
    {
      kind: 'table',
      title: labels.patientGrowthSection,
      headers: [labels.date, labels.count],
      rows: overview.patientGrowthTrend.map((point) => [fmtDate(point.date), fmtNum(point.count)]),
    },
    {
      kind: 'table',
      title: labels.branchSection,
      headers: [labels.branch, labels.appointments, labels.revenue],
      rows: overview.branchPerformance.map((branch) => [
        pickLocalizedExportName(locale, branch.name, branch.nameAr),
        fmtNum(branch.appointments),
        fmtCur(branch.revenue),
      ]),
    },
    {
      kind: 'table',
      title: labels.doctorSection,
      headers: [labels.provider, labels.appointments, labels.encounters],
      rows: overview.doctorPerformance.map((doc) => [
        formatExportPersonName(
          locale,
          doc.firstName,
          doc.lastName,
          doc.firstNameAr,
          doc.lastNameAr,
        ),
        fmtNum(doc.appointments),
        fmtNum(doc.encounters),
      ]),
    },
  ];

  const generatedAtValue = forPdf
    ? formatExportDateTimeForPdf(overview.generatedAt, locale)
    : formatExportDateTime(overview.generatedAt, locale);

  return {
    title: labels.title,
    subtitle: `${labels.generatedAt}: ${generatedAtValue}`,
    subtitleParts:
      forPdf && locale.startsWith('ar')
        ? { label: labels.generatedAt, value: generatedAtValue }
        : undefined,
    sections: sections.filter((section) =>
      section.kind === 'metrics' ? section.rows.length > 0 : section.rows.length > 0,
    ),
  };
}
