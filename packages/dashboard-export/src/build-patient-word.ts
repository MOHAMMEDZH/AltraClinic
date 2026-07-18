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

export interface PatientWordSection {
  title: string;
  rows: Array<[string, string]>;
}

export interface PatientWordDocument {
  title: string;
  subtitle: string;
  sections: PatientWordSection[];
  notesTitle?: string;
  notes?: string | null;
}

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

/** Build a patient summary Word document (.docx) with RTL Arabic support. */
export async function buildPatientWordBuffer(
  model: PatientWordDocument,
  locale: string,
): Promise<ArrayBuffer> {
  const isRtl = isRtlLocale(locale);
  const blocks: (Paragraph | Table)[] = [
    paragraph(model.title, isRtl, { bold: true, color: COLORS.primary, size: 16, spacingAfter: 120 }),
    paragraph(model.subtitle, isRtl, { color: COLORS.muted, size: 10, spacingAfter: 240 }),
  ];

  for (const section of model.sections) {
    const rows = section.rows.filter((row) => row[1]?.trim());
    if (rows.length === 0) continue;

    const tableRows: TableRow[] = [
      new TableRow({
        children: [
          new TableCell({
            columnSpan: 2,
            borders: thinBorder,
            shading: { fill: COLORS.primary, type: ShadingType.CLEAR, color: 'auto' },
            verticalAlign: VerticalAlign.CENTER,
            children: [paragraph(section.title, isRtl, { bold: true, color: COLORS.white, size: 12 })],
          }),
        ],
      }),
      ...rows.map(
        (row, index) =>
          new TableRow({
            children: [
              dataCell(row[0], isRtl, {
                bold: true,
                fill: index % 2 === 1 ? COLORS.zebra : undefined,
                color: COLORS.primary,
              }),
              dataCell(row[1], isRtl, { fill: index % 2 === 1 ? COLORS.zebra : undefined }),
            ],
          }),
      ),
    ];

    blocks.push(
      new Table({
        visuallyRightToLeft: isRtl,
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: tableRows,
      }),
    );
  }

  if (model.notes?.trim()) {
    blocks.push(
      paragraph(model.notesTitle ?? 'Notes', isRtl, {
        bold: true,
        color: COLORS.primary,
        size: 12,
        spacingAfter: 120,
      }),
      paragraph(model.notes.trim(), isRtl, { spacingAfter: 240 }),
    );
  }

  const doc = new Document({
    creator: 'Booking System',
    title: model.title,
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, right: 720, bottom: 720, left: 720 },
          },
        },
        children: blocks,
      },
    ],
  });

  return Packer.toArrayBuffer(doc);
}
