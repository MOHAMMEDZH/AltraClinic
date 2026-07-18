"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardExportDocument = buildDashboardExportDocument;
const format_1 = require("./format");
/** Build structured export sections shared by Excel and PDF renderers. */
function buildDashboardExportDocument(overview, labels, locale, options) {
    const forPdf = options?.forPdf === true;
    const fmtNum = (value) => forPdf ? (0, format_1.formatExportNumberForPdf)(value, locale) : (0, format_1.formatExportNumber)(value, locale);
    const fmtCur = (amount) => forPdf ? (0, format_1.formatExportCurrencyForPdf)(amount, locale) : (0, format_1.formatExportCurrency)(amount, locale);
    const fmtPct = (value) => forPdf ? (0, format_1.formatExportPercentForPdf)(value, locale) : (0, format_1.formatExportPercent)(value, locale);
    const fmtDate = (iso) => forPdf ? (0, format_1.formatExportDateForPdf)(iso, locale) : (0, format_1.formatExportDate)(iso, locale);
    const { kpis, businessHealth } = overview;
    const sections = [
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
                (0, format_1.pickLocalizedExportName)(locale, branch.name, branch.nameAr),
                fmtNum(branch.appointments),
                fmtCur(branch.revenue),
            ]),
        },
        {
            kind: 'table',
            title: labels.doctorSection,
            headers: [labels.provider, labels.appointments, labels.encounters],
            rows: overview.doctorPerformance.map((doc) => [
                (0, format_1.formatExportPersonName)(locale, doc.firstName, doc.lastName, doc.firstNameAr, doc.lastNameAr),
                fmtNum(doc.appointments),
                fmtNum(doc.encounters),
            ]),
        },
    ];
    const generatedAtValue = forPdf
        ? (0, format_1.formatExportDateTimeForPdf)(overview.generatedAt, locale)
        : (0, format_1.formatExportDateTime)(overview.generatedAt, locale);
    return {
        title: labels.title,
        subtitle: `${labels.generatedAt}: ${generatedAtValue}`,
        subtitleParts: forPdf && locale.startsWith('ar')
            ? { label: labels.generatedAt, value: generatedAtValue }
            : undefined,
        sections: sections.filter((section) => section.kind === 'metrics' ? section.rows.length > 0 : section.rows.length > 0),
    };
}
