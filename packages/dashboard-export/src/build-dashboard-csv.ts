import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
import {
  formatExportCurrency,
  formatExportDate,
  formatExportDateTime,
  formatExportNumber,
  formatExportPercent,
  formatExportPersonName,
  pickLocalizedExportName,
} from './format';

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function row(values: Array<string | number>): string {
  return values.map(escapeCsv).join(',');
}

function addMetricSection(
  lines: string[],
  sectionTitle: string,
  rows: Array<[string, string | number]>,
  labels: DashboardExportLabels,
): void {
  lines.push(row([sectionTitle]));
  lines.push(row([labels.metric, labels.value]));
  for (const [metric, value] of rows) {
    lines.push(row([metric, value]));
  }
  lines.push('');
}

function addTrendSection(
  lines: string[],
  sectionTitle: string,
  headers: [string, string],
  data: Array<[string, string | number]>,
): void {
  lines.push(row([sectionTitle]));
  lines.push(row(headers));
  for (const entry of data) {
    lines.push(row(entry));
  }
  lines.push('');
}

/** Build UTF-8 CSV text with section headers and localized labels. */
export function buildDashboardCsv(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
): string {
  const lines: string[] = [];
  const { kpis, businessHealth } = overview;

  lines.push(row([labels.title]));
  lines.push(row([labels.generatedAt, formatExportDateTime(overview.generatedAt, locale)]));
  lines.push('');

  addMetricSection(
    lines,
    labels.kpisSection,
    [
      [labels.totalPatients, formatExportNumber(kpis.totalPatients, locale)],
      [labels.appointmentsToday, formatExportNumber(kpis.appointmentsToday, locale)],
      [labels.queueWaiting, formatExportNumber(kpis.queueWaiting, locale)],
      [labels.revenueToday, formatExportCurrency(kpis.revenueToday, locale)],
      [labels.revenueMonth, formatExportCurrency(kpis.revenueMonth, locale)],
      [labels.outstandingAmount, formatExportCurrency(kpis.outstandingAmount, locale)],
      [labels.lowStockCount, formatExportNumber(kpis.lowStockCount, locale)],
    ],
    labels,
  );

  addMetricSection(
    lines,
    labels.healthSection,
    [
      [labels.utilization, formatExportPercent(businessHealth.utilizationPercent, locale)],
      [labels.collection, formatExportPercent(businessHealth.collectionPercent, locale)],
      [labels.noShow, formatExportPercent(businessHealth.noShowPercent, locale)],
    ],
    labels,
  );

  addTrendSection(
    lines,
    labels.revenueTrendSection,
    [labels.date, labels.amount],
    overview.revenueTrend.map((point) => [
      formatExportDate(point.date, locale),
      formatExportCurrency(point.amount, locale),
    ]),
  );

  addTrendSection(
    lines,
    labels.appointmentTrendSection,
    [labels.date, labels.count],
    overview.appointmentTrend.map((point) => [
      formatExportDate(point.date, locale),
      formatExportNumber(point.count, locale),
    ]),
  );

  addTrendSection(
    lines,
    labels.patientGrowthSection,
    [labels.date, labels.count],
    overview.patientGrowthTrend.map((point) => [
      formatExportDate(point.date, locale),
      formatExportNumber(point.count, locale),
    ]),
  );

  if (overview.branchPerformance.length > 0) {
    lines.push(row([labels.branchSection]));
    lines.push(row([labels.branch, labels.appointments, labels.revenue]));
    for (const branch of overview.branchPerformance) {
      lines.push(
        row([
          pickLocalizedExportName(locale, branch.name, branch.nameAr),
          formatExportNumber(branch.appointments, locale),
          formatExportCurrency(branch.revenue, locale),
        ]),
      );
    }
    lines.push('');
  }

  if (overview.doctorPerformance.length > 0) {
    lines.push(row([labels.doctorSection]));
    lines.push(row([labels.provider, labels.appointments, labels.encounters]));
    for (const doc of overview.doctorPerformance) {
      lines.push(
        row([
          formatExportPersonName(
            locale,
            doc.firstName,
            doc.lastName,
            doc.firstNameAr,
            doc.lastNameAr,
          ),
          formatExportNumber(doc.appointments, locale),
          formatExportNumber(doc.encounters, locale),
        ]),
      );
    }
  }

  return lines.join('\r\n');
}

/** Prefix with UTF-8 BOM so Excel opens Arabic correctly. */
export function buildDashboardCsvWithBom(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
): string {
  return `\uFEFF${buildDashboardCsv(overview, labels, locale)}`;
}

export function countDashboardExportRows(overview: DashboardOverviewForExport): number {
  return (
    9 +
    overview.revenueTrend.length +
    overview.appointmentTrend.length +
    overview.patientGrowthTrend.length +
    overview.branchPerformance.length +
    overview.doctorPerformance.length
  );
}
