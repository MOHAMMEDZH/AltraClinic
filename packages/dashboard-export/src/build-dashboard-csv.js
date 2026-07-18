"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardCsv = buildDashboardCsv;
exports.buildDashboardCsvWithBom = buildDashboardCsvWithBom;
exports.countDashboardExportRows = countDashboardExportRows;
const format_1 = require("./format");
function escapeCsv(value) {
    const text = String(value);
    if (text.includes(',') || text.includes('"') || text.includes('\n')) {
        return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
}
function row(values) {
    return values.map(escapeCsv).join(',');
}
function addMetricSection(lines, sectionTitle, rows, labels) {
    lines.push(row([sectionTitle]));
    lines.push(row([labels.metric, labels.value]));
    for (const [metric, value] of rows) {
        lines.push(row([metric, value]));
    }
    lines.push('');
}
function addTrendSection(lines, sectionTitle, headers, data) {
    lines.push(row([sectionTitle]));
    lines.push(row(headers));
    for (const entry of data) {
        lines.push(row(entry));
    }
    lines.push('');
}
/** Build UTF-8 CSV text with section headers and localized labels. */
function buildDashboardCsv(overview, labels, locale) {
    const lines = [];
    const { kpis, businessHealth } = overview;
    lines.push(row([labels.title]));
    lines.push(row([labels.generatedAt, (0, format_1.formatExportDateTime)(overview.generatedAt, locale)]));
    lines.push('');
    addMetricSection(lines, labels.kpisSection, [
        [labels.totalPatients, (0, format_1.formatExportNumber)(kpis.totalPatients, locale)],
        [labels.appointmentsToday, (0, format_1.formatExportNumber)(kpis.appointmentsToday, locale)],
        [labels.queueWaiting, (0, format_1.formatExportNumber)(kpis.queueWaiting, locale)],
        [labels.revenueToday, (0, format_1.formatExportCurrency)(kpis.revenueToday, locale)],
        [labels.revenueMonth, (0, format_1.formatExportCurrency)(kpis.revenueMonth, locale)],
        [labels.outstandingAmount, (0, format_1.formatExportCurrency)(kpis.outstandingAmount, locale)],
        [labels.lowStockCount, (0, format_1.formatExportNumber)(kpis.lowStockCount, locale)],
    ], labels);
    addMetricSection(lines, labels.healthSection, [
        [labels.utilization, (0, format_1.formatExportPercent)(businessHealth.utilizationPercent, locale)],
        [labels.collection, (0, format_1.formatExportPercent)(businessHealth.collectionPercent, locale)],
        [labels.noShow, (0, format_1.formatExportPercent)(businessHealth.noShowPercent, locale)],
    ], labels);
    addTrendSection(lines, labels.revenueTrendSection, [labels.date, labels.amount], overview.revenueTrend.map((point) => [
        (0, format_1.formatExportDate)(point.date, locale),
        (0, format_1.formatExportCurrency)(point.amount, locale),
    ]));
    addTrendSection(lines, labels.appointmentTrendSection, [labels.date, labels.count], overview.appointmentTrend.map((point) => [
        (0, format_1.formatExportDate)(point.date, locale),
        (0, format_1.formatExportNumber)(point.count, locale),
    ]));
    addTrendSection(lines, labels.patientGrowthSection, [labels.date, labels.count], overview.patientGrowthTrend.map((point) => [
        (0, format_1.formatExportDate)(point.date, locale),
        (0, format_1.formatExportNumber)(point.count, locale),
    ]));
    if (overview.branchPerformance.length > 0) {
        lines.push(row([labels.branchSection]));
        lines.push(row([labels.branch, labels.appointments, labels.revenue]));
        for (const branch of overview.branchPerformance) {
            lines.push(row([
                (0, format_1.pickLocalizedExportName)(locale, branch.name, branch.nameAr),
                (0, format_1.formatExportNumber)(branch.appointments, locale),
                (0, format_1.formatExportCurrency)(branch.revenue, locale),
            ]));
        }
        lines.push('');
    }
    if (overview.doctorPerformance.length > 0) {
        lines.push(row([labels.doctorSection]));
        lines.push(row([labels.provider, labels.appointments, labels.encounters]));
        for (const doc of overview.doctorPerformance) {
            lines.push(row([
                (0, format_1.formatExportPersonName)(locale, doc.firstName, doc.lastName, doc.firstNameAr, doc.lastNameAr),
                (0, format_1.formatExportNumber)(doc.appointments, locale),
                (0, format_1.formatExportNumber)(doc.encounters, locale),
            ]));
        }
    }
    return lines.join('\r\n');
}
/** Prefix with UTF-8 BOM so Excel opens Arabic correctly. */
function buildDashboardCsvWithBom(overview, labels, locale) {
    return `\uFEFF${buildDashboardCsv(overview, labels, locale)}`;
}
function countDashboardExportRows(overview) {
    return (9 +
        overview.revenueTrend.length +
        overview.appointmentTrend.length +
        overview.patientGrowthTrend.length +
        overview.branchPerformance.length +
        overview.doctorPerformance.length);
}
