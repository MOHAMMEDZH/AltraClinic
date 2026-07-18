"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardExcelBuffer = buildDashboardExcelBuffer;
const exceljs_1 = __importDefault(require("exceljs"));
const build_dashboard_sections_1 = require("./build-dashboard-sections");
const format_1 = require("./format");
const COLORS = {
    primary: 'FF156B56',
    primaryLight: 'FFE8F5F1',
    white: 'FFFFFFFF',
    text: 'FF1F2937',
    zebra: 'FFF9FAFB',
    border: 'FFD0D5DD',
};
const thinBorder = {
    top: { style: 'thin', color: { argb: COLORS.border } },
    left: { style: 'thin', color: { argb: COLORS.border } },
    bottom: { style: 'thin', color: { argb: COLORS.border } },
    right: { style: 'thin', color: { argb: COLORS.border } },
};
function font(isRtl, bold = false, color = COLORS.text, size = 11) {
    return {
        name: isRtl ? 'Arial' : 'Calibri',
        bold,
        size,
        color: { argb: color },
    };
}
class SheetWriter {
    constructor(sheet, isRtl) {
        this.sheet = sheet;
        this.isRtl = isRtl;
        this.row = 1;
    }
    applySectionHeader(text, colSpan) {
        this.sheet.mergeCells(this.row, 1, this.row, colSpan);
        const cell = this.sheet.getCell(this.row, 1);
        cell.value = text;
        cell.font = font(this.isRtl, true, COLORS.white, 12);
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primary } };
        cell.alignment = {
            vertical: 'middle',
            horizontal: this.isRtl ? 'right' : 'left',
            readingOrder: this.isRtl ? 'rtl' : 'ltr',
        };
        this.sheet.getRow(this.row).height = 26;
        this.row += 1;
    }
    applyTableHeader(values) {
        values.forEach((value, index) => {
            const cell = this.sheet.getCell(this.row, index + 1);
            cell.value = value;
            cell.font = font(this.isRtl, true, COLORS.primary, 11);
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.primaryLight } };
            cell.border = thinBorder;
            cell.alignment = {
                vertical: 'middle',
                horizontal: this.isRtl ? 'right' : 'left',
                readingOrder: this.isRtl ? 'rtl' : 'ltr',
            };
        });
        this.sheet.getRow(this.row).height = 22;
        this.row += 1;
    }
    applyDataRow(values, stripe) {
        values.forEach((value, index) => {
            const cell = this.sheet.getCell(this.row, index + 1);
            cell.value = value;
            cell.font = font(this.isRtl);
            cell.border = thinBorder;
            cell.alignment = {
                vertical: 'middle',
                horizontal: this.isRtl ? 'right' : 'left',
                readingOrder: this.isRtl ? 'rtl' : 'ltr',
            };
            if (stripe) {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: COLORS.zebra } };
            }
        });
        this.row += 1;
    }
    addTitle(title, subtitle, colSpan) {
        this.sheet.mergeCells(this.row, 1, this.row, colSpan);
        const titleCell = this.sheet.getCell(this.row, 1);
        titleCell.value = title;
        titleCell.font = font(this.isRtl, true, COLORS.primary, 16);
        titleCell.alignment = {
            vertical: 'middle',
            horizontal: this.isRtl ? 'right' : 'left',
            readingOrder: this.isRtl ? 'rtl' : 'ltr',
        };
        this.sheet.getRow(this.row).height = 28;
        this.row += 1;
        this.sheet.mergeCells(this.row, 1, this.row, colSpan);
        const subtitleCell = this.sheet.getCell(this.row, 1);
        subtitleCell.value = subtitle;
        subtitleCell.font = font(this.isRtl, false, 'FF6B7280', 10);
        subtitleCell.alignment = {
            vertical: 'middle',
            horizontal: this.isRtl ? 'right' : 'left',
            readingOrder: this.isRtl ? 'rtl' : 'ltr',
        };
        this.row += 2;
    }
    addMetricsSection(title, headers, rows) {
        this.applySectionHeader(title, 2);
        this.applyTableHeader(headers);
        rows.forEach(([metric, value], index) => {
            this.applyDataRow([metric, value], index % 2 === 1);
        });
        this.row += 1;
    }
    addTableSection(title, headers, rows) {
        if (rows.length === 0)
            return;
        this.applySectionHeader(title, headers.length);
        this.applyTableHeader(headers);
        rows.forEach((entry, index) => {
            this.applyDataRow(entry, index % 2 === 1);
        });
        this.row += 1;
    }
}
/** Build a styled Excel workbook buffer with section colors and RTL Arabic support. */
async function buildDashboardExcelBuffer(overview, labels, locale) {
    const isRtl = (0, format_1.isRtlLocale)(locale);
    const workbook = new exceljs_1.default.Workbook();
    workbook.creator = 'Booking System';
    workbook.created = new Date();
    const sheetName = labels.title.slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName, {
        views: [{ rightToLeft: isRtl }],
        properties: { defaultRowHeight: 20 },
    });
    sheet.columns = [{ width: 34 }, { width: 22 }, { width: 18 }];
    const writer = new SheetWriter(sheet, isRtl);
    const documentModel = (0, build_dashboard_sections_1.buildDashboardExportDocument)(overview, labels, locale);
    writer.addTitle(documentModel.title, documentModel.subtitle, 2);
    const metricHeaders = [labels.metric, labels.value];
    for (const section of documentModel.sections) {
        if (section.kind === 'metrics') {
            writer.addMetricsSection(section.title, metricHeaders, section.rows);
        }
        else {
            writer.addTableSection(section.title, section.headers, section.rows);
        }
    }
    return workbook.xlsx.writeBuffer();
}
