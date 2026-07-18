import ExcelJS from 'exceljs';
import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
import { buildDashboardExportDocument } from './build-dashboard-sections';
import { isRtlLocale } from './format';

const COLORS = {
  primary: 'FF156B56',
  primaryLight: 'FFE8F5F1',
  white: 'FFFFFFFF',
  text: 'FF1F2937',
  zebra: 'FFF9FAFB',
  border: 'FFD0D5DD',
};

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: COLORS.border } },
  left: { style: 'thin', color: { argb: COLORS.border } },
  bottom: { style: 'thin', color: { argb: COLORS.border } },
  right: { style: 'thin', color: { argb: COLORS.border } },
};

function font(isRtl: boolean, bold = false, color = COLORS.text, size = 11): Partial<ExcelJS.Font> {
  return {
    name: isRtl ? 'Arial' : 'Calibri',
    bold,
    size,
    color: { argb: color },
  };
}

class SheetWriter {
  private row = 1;

  constructor(
    private readonly sheet: ExcelJS.Worksheet,
    private readonly isRtl: boolean,
  ) {}

  private applySectionHeader(text: string, colSpan: number): void {
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

  private applyTableHeader(values: string[]): void {
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

  private applyDataRow(values: Array<string | number>, stripe: boolean): void {
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

  addTitle(title: string, subtitle: string, colSpan: number): void {
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

  addMetricsSection(title: string, headers: [string, string], rows: Array<[string, string]>): void {
    this.applySectionHeader(title, 2);
    this.applyTableHeader(headers);
    rows.forEach(([metric, value], index) => {
      this.applyDataRow([metric, value], index % 2 === 1);
    });
    this.row += 1;
  }

  addTableSection(title: string, headers: string[], rows: string[][]): void {
    if (rows.length === 0) return;
    this.applySectionHeader(title, headers.length);
    this.applyTableHeader(headers);
    rows.forEach((entry, index) => {
      this.applyDataRow(entry, index % 2 === 1);
    });
    this.row += 1;
  }
}

/** Build a styled Excel workbook buffer with section colors and RTL Arabic support. */
export async function buildDashboardExcelBuffer(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
): Promise<ArrayBuffer> {
  const isRtl = isRtlLocale(locale);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Booking System';
  workbook.created = new Date();

  const sheetName = labels.title.slice(0, 31);
  const sheet = workbook.addWorksheet(sheetName, {
    views: [{ rightToLeft: isRtl }],
    properties: { defaultRowHeight: 20 },
  });

  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 18 }];

  const writer = new SheetWriter(sheet, isRtl);
  const documentModel = buildDashboardExportDocument(overview, labels, locale);

  writer.addTitle(documentModel.title, documentModel.subtitle, 2);

  const metricHeaders: [string, string] = [labels.metric, labels.value];
  for (const section of documentModel.sections) {
    if (section.kind === 'metrics') {
      writer.addMetricsSection(section.title, metricHeaders, section.rows);
    } else {
      writer.addTableSection(section.title, section.headers, section.rows);
    }
  }

  return workbook.xlsx.writeBuffer();
}
