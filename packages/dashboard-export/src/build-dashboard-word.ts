import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';
import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
import { buildDashboardExportDocument, type DashboardExportSection } from './build-dashboard-sections';
import { isRtlLocale } from './format';

const COLORS = {
  primary: '156B56',
  primaryLight: 'E8F5F1',
  text: '1F2937',
  muted: '6B7280',
  white: 'FFFFFF',
  zebra: 'F9FAFB',
  border: 'D0D5DD',
};

const thinBorder = {
  top: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
  left: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
  right: { style: BorderStyle.SINGLE, size: 1, color: COLORS.border },
};

function bodyFont(isRtl: boolean): string {
  return isRtl ? 'Arial' : 'Calibri';
}

function textRun(
  text: string,
  isRtl: boolean,
  options: { bold?: boolean; color?: string; size?: number } = {},
): TextRun {
  return new TextRun({
    text,
    font: bodyFont(isRtl),
    bold: options.bold ?? false,
    size: (options.size ?? 11) * 2,
    color: options.color ?? COLORS.text,
    rightToLeft: isRtl,
  });
}

function paragraph(
  text: string,
  isRtl: boolean,
  options: { bold?: boolean; color?: string; size?: number; spacingAfter?: number } = {},
): Paragraph {
  return new Paragraph({
    bidirectional: isRtl,
    alignment: isRtl ? AlignmentType.RIGHT : AlignmentType.LEFT,
    spacing: options.spacingAfter ? { after: options.spacingAfter } : undefined,
    children: [
      textRun(text, isRtl, {
        bold: options.bold,
        color: options.color,
        size: options.size,
      }),
    ],
  });
}

function dataCell(
  text: string,
  isRtl: boolean,
  options: { bold?: boolean; fill?: string; color?: string } = {},
): TableCell {
  return new TableCell({
    borders: thinBorder,
    shading: options.fill
      ? { fill: options.fill, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    verticalAlign: VerticalAlign.CENTER,
    children: [
      paragraph(text, isRtl, {
        bold: options.bold,
        color: options.color,
      }),
    ],
  });
}

class WordWriter {
  private readonly blocks: (Paragraph | Table)[] = [];

  constructor(private readonly isRtl: boolean) {}

  addTitle(title: string, subtitle: string): void {
    this.blocks.push(
      paragraph(title, this.isRtl, { bold: true, color: COLORS.primary, size: 16, spacingAfter: 120 }),
      paragraph(subtitle, this.isRtl, { color: COLORS.muted, size: 10, spacingAfter: 240 }),
    );
  }

  private sectionHeaderRow(title: string, colSpan: number): TableRow {
    return new TableRow({
      children: [
        new TableCell({
          columnSpan: colSpan,
          borders: thinBorder,
          shading: { fill: COLORS.primary, type: ShadingType.CLEAR, color: 'auto' },
          verticalAlign: VerticalAlign.CENTER,
          children: [paragraph(title, this.isRtl, { bold: true, color: COLORS.white, size: 12 })],
        }),
      ],
    });
  }

  private headerRow(headers: string[]): TableRow {
    return new TableRow({
      children: headers.map((header) =>
        dataCell(header, this.isRtl, {
          bold: true,
          fill: COLORS.primaryLight,
          color: COLORS.primary,
        }),
      ),
    });
  }

  private dataRow(values: string[], stripe: boolean): TableRow {
    return new TableRow({
      children: values.map((value) =>
        dataCell(value, this.isRtl, { fill: stripe ? COLORS.zebra : undefined }),
      ),
    });
  }

  private addTable(title: string, headers: string[], rows: string[][]): void {
    if (rows.length === 0) return;
    const tableRows = [
      this.sectionHeaderRow(title, headers.length),
      this.headerRow(headers),
      ...rows.map((row, index) => this.dataRow(row, index % 2 === 1)),
    ];
    this.blocks.push(
      new Table({
        visuallyRightToLeft: this.isRtl,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    );
  }

  addMetricsSection(title: string, headers: [string, string], rows: Array<[string, string]>): void {
    this.addTable(title, headers, rows);
  }

  addTableSection(title: string, headers: string[], rows: string[][]): void {
    this.addTable(title, headers, rows);
  }

  build(): (Paragraph | Table)[] {
    return this.blocks;
  }
}

function renderSection(
  writer: WordWriter,
  section: DashboardExportSection,
  metricHeaders: [string, string],
): void {
  if (section.kind === 'metrics') {
    writer.addMetricsSection(section.title, metricHeaders, section.rows);
    return;
  }
  writer.addTableSection(section.title, section.headers, section.rows);
}

/** Build a styled Word document (.docx) with native RTL Arabic support. */
export async function buildDashboardWordBuffer(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
): Promise<ArrayBuffer> {
  const isRtl = isRtlLocale(locale);
  const documentModel = buildDashboardExportDocument(overview, labels, locale);
  const writer = new WordWriter(isRtl);

  writer.addTitle(documentModel.title, documentModel.subtitle);

  const metricHeaders: [string, string] = [labels.metric, labels.value];
  for (const section of documentModel.sections) {
    renderSection(writer, section, metricHeaders);
  }

  const doc = new Document({
    creator: 'Booking System',
    title: labels.title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: writer.build(),
      },
    ],
  });

  return Packer.toArrayBuffer(doc);
}
