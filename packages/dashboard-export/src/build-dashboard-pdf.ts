import { PDFDocument, StandardFonts, rgb, type PDFPage, type PDFFont, type PDFImage } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { DashboardExportLabels, DashboardOverviewForExport } from './types';
import { buildDashboardExportDocument, type DashboardExportSection } from './build-dashboard-sections';
import { isRtlLocale } from './format';
import { containsArabicLetters, prepareArabicPdfText, stripBidiControls } from './prepare-arabic-pdf-text';

const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CELL_PADDING = 6;

const COLORS = {
  primary: rgb(0.082, 0.419, 0.337),
  primaryLight: rgb(0.909, 0.961, 0.945),
  text: rgb(0.122, 0.161, 0.216),
  muted: rgb(0.42, 0.447, 0.502),
  white: rgb(1, 1, 1),
  zebra: rgb(0.976, 0.98, 0.984),
  border: rgb(0.816, 0.835, 0.867),
};

export interface DashboardPdfFontBundle {
  arabicRegular?: Uint8Array | ArrayBuffer;
  arabicBold?: Uint8Array | ArrayBuffer;
}

export interface DashboardPdfBranding {
  clinicName?: string;
  logoBytes?: Uint8Array;
  logoMimeType?: string;
}

interface FontSet {
  regular: PDFFont;
  bold: PDFFont;
  arabicRegular?: PDFFont;
  arabicBold?: PDFFont;
}

function toUint8Array(data: Uint8Array | ArrayBuffer): Uint8Array {
  return data instanceof Uint8Array ? data : new Uint8Array(data);
}

function orderForRtl<T>(items: readonly T[], isRtl: boolean): T[] {
  return isRtl ? [...items].reverse() : [...items];
}

class PdfWriter {
  private page: PDFPage;
  private y = PAGE_HEIGHT - MARGIN;

  private pageIndex = 1;

  constructor(
    private readonly doc: PDFDocument,
    private readonly fonts: FontSet,
    private readonly isRtl: boolean,
    private readonly branding?: DashboardPdfBranding,
    private readonly logoImage?: PDFImage,
  ) {
    this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.drawPageFooter();
  }

  private drawPageFooter(): void {
    const footerY = 24;
    if (this.branding?.clinicName) {
      this.drawLatinText(this.branding.clinicName, MARGIN, footerY, 8, false, COLORS.muted);
    }
    const pageLabel = `Page ${this.pageIndex}`;
    const font = this.pickLatinFont(false);
    const textWidth = font.widthOfTextAtSize(pageLabel, 8);
    this.page.drawText(pageLabel, {
      x: PAGE_WIDTH - MARGIN - textWidth,
      y: footerY,
      size: 8,
      font,
      color: COLORS.muted,
    });
  }

  private get arabicEnabled(): boolean {
    return this.isRtl && Boolean(this.fonts.arabicRegular);
  }

  private pickLatinFont(bold: boolean): PDFFont {
    return bold ? this.fonts.bold : this.fonts.regular;
  }

  private pickArabicFont(bold: boolean): PDFFont {
    if (bold && this.fonts.arabicBold) return this.fonts.arabicBold;
    return this.fonts.arabicRegular ?? this.pickLatinFont(bold);
  }

  private ensureSpace(height: number): void {
    if (this.y - height >= MARGIN + 36) return;
    this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    this.pageIndex++;
    this.y = PAGE_HEIGHT - MARGIN;
    this.drawPageFooter();
  }

  private drawLatinText(
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color = COLORS.text,
    cellWidth?: number,
  ): void {
    const display = stripBidiControls(text);
    const font = this.pickLatinFont(bold);
    const textWidth = font.widthOfTextAtSize(display, size);
    let drawX = x;
    if (cellWidth !== undefined) {
      drawX = this.isRtl ? x + cellWidth - textWidth - CELL_PADDING : x + CELL_PADDING;
    }
    this.page.drawText(display, { x: drawX, y, size, font, color });
  }

  private drawArabicTextLine(
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color = COLORS.text,
    cellWidth?: number,
  ): void {
    const font = this.pickArabicFont(bold);
    const display = prepareArabicPdfText(text);
    const textWidth = font.widthOfTextAtSize(display, size);
    let drawX = x;
    if (cellWidth !== undefined) {
      drawX = this.isRtl ? x + cellWidth - textWidth - CELL_PADDING : x + CELL_PADDING;
    } else if (this.isRtl) {
      drawX = x + CONTENT_WIDTH - textWidth;
    }
    this.page.drawText(display, { x: drawX, y, size, font, color });
  }

  private drawText(
    text: string,
    x: number,
    y: number,
    size: number,
    bold = false,
    color = COLORS.text,
    cellWidth?: number,
  ): void {
    if (this.arabicEnabled && containsArabicLetters(text)) {
      this.drawArabicTextLine(text, x, y, size, bold, color, cellWidth);
      return;
    }
    this.drawLatinText(text, x, y, size, bold, color, cellWidth);
  }

  addTitle(
    title: string,
    subtitle: string,
    subtitleParts?: { label: string; value: string },
  ): void {
    if (this.logoImage) {
      const logoHeight = 40;
      const scale = logoHeight / this.logoImage.height;
      const logoWidth = this.logoImage.width * scale;
      this.ensureSpace(logoHeight + 56);
      this.page.drawImage(this.logoImage, {
        x: MARGIN,
        y: this.y - logoHeight,
        width: logoWidth,
        height: logoHeight,
      });
      this.y -= logoHeight + 12;
    }

    this.ensureSpace(48);
    this.drawText(title, MARGIN, this.y, 18, true, COLORS.primary, CONTENT_WIDTH);
    this.y -= 24;

    if (subtitleParts && this.arabicEnabled) {
      const lineY = this.y;
      this.drawLatinText(subtitleParts.value, MARGIN, lineY, 10, false, COLORS.muted);
      this.drawArabicTextLine(
        subtitleParts.label,
        MARGIN,
        lineY,
        10,
        false,
        COLORS.muted,
        CONTENT_WIDTH,
      );
    } else {
      this.drawText(subtitle, MARGIN, this.y, 10, false, COLORS.muted, CONTENT_WIDTH);
    }
    this.y -= 20;
  }

  private drawSectionHeader(title: string): void {
    const height = 24;
    this.ensureSpace(height + 6);
    this.page.drawRectangle({
      x: MARGIN,
      y: this.y - height + 6,
      width: CONTENT_WIDTH,
      height,
      color: COLORS.primary,
    });
    this.drawText(title, MARGIN, this.y - 14, 12, true, COLORS.white, CONTENT_WIDTH);
    this.y -= height + 6;
  }

  private drawTableHeader(headers: string[], colWidths: number[]): void {
    const height = 22;
    this.ensureSpace(height + 2);
    const orderedHeaders = orderForRtl(headers, this.isRtl);
    const orderedWidths = orderForRtl(colWidths, this.isRtl);

    let x = MARGIN;
    orderedHeaders.forEach((header, index) => {
      const width = orderedWidths[index] ?? CONTENT_WIDTH / orderedHeaders.length;
      this.page.drawRectangle({
        x,
        y: this.y - height + 6,
        width,
        height,
        color: COLORS.primaryLight,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });
      this.drawText(header, x, this.y - 14, 10, true, COLORS.primary, width);
      x += width;
    });
    this.y -= height + 2;
  }

  private drawTableRow(values: string[], colWidths: number[], stripe: boolean): void {
    const height = 20;
    this.ensureSpace(height + 1);
    const orderedValues = orderForRtl(values, this.isRtl);
    const orderedWidths = orderForRtl(colWidths, this.isRtl);

    let x = MARGIN;
    orderedValues.forEach((value, index) => {
      const width = orderedWidths[index] ?? CONTENT_WIDTH / orderedValues.length;
      this.page.drawRectangle({
        x,
        y: this.y - height + 6,
        width,
        height,
        color: stripe ? COLORS.zebra : COLORS.white,
        borderColor: COLORS.border,
        borderWidth: 0.5,
      });
      this.drawText(value, x, this.y - 13, 10, false, COLORS.text, width);
      x += width;
    });
    this.y -= height + 1;
  }

  addMetricsSection(title: string, headers: [string, string], rows: Array<[string, string]>): void {
    this.drawSectionHeader(title);
    const colWidths = [CONTENT_WIDTH * 0.58, CONTENT_WIDTH * 0.42];
    this.drawTableHeader(headers, colWidths);
    rows.forEach(([metric, value], index) => {
      this.drawTableRow([metric, value], colWidths, index % 2 === 1);
    });
    this.y -= 8;
  }

  addTableSection(title: string, headers: string[], rows: string[][]): void {
    if (rows.length === 0) return;
    this.drawSectionHeader(title);
    const colWidths =
      headers.length === 3
        ? [CONTENT_WIDTH * 0.46, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.27]
        : [CONTENT_WIDTH * 0.58, CONTENT_WIDTH * 0.42];
    this.drawTableHeader(headers, colWidths);
    rows.forEach((row, index) => {
      this.drawTableRow(row, colWidths, index % 2 === 1);
    });
    this.y -= 8;
  }
}

async function embedFonts(doc: PDFDocument, fonts?: DashboardPdfFontBundle): Promise<FontSet> {
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const bundle = fonts ?? undefined;

  if (!bundle?.arabicRegular || !bundle?.arabicBold) {
    return { regular, bold };
  }

  doc.registerFontkit(fontkit);
  return {
    regular,
    bold,
    arabicRegular: await doc.embedFont(toUint8Array(bundle.arabicRegular), { subset: false }),
    arabicBold: await doc.embedFont(toUint8Array(bundle.arabicBold), { subset: false }),
  };
}

function renderSection(
  writer: PdfWriter,
  section: DashboardExportSection,
  metricHeaders: [string, string],
): void {
  if (section.kind === 'metrics') {
    writer.addMetricsSection(section.title, metricHeaders, section.rows);
    return;
  }
  writer.addTableSection(section.title, section.headers, section.rows);
}

/** Build a styled PDF report matching the Excel export layout. */
export async function buildDashboardPdfBytes(
  overview: DashboardOverviewForExport,
  labels: DashboardExportLabels,
  locale: string,
  fonts?: DashboardPdfFontBundle,
  branding?: DashboardPdfBranding,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(labels.title);
  doc.setCreator(branding?.clinicName ? `${branding.clinicName} — Booking System` : 'Booking System');

  const fontSet = await embedFonts(doc, fonts);
  let logoImage: PDFImage | undefined;
  if (branding?.logoBytes?.length) {
    try {
      logoImage = branding.logoMimeType?.includes('png')
        ? await doc.embedPng(branding.logoBytes)
        : await doc.embedJpg(branding.logoBytes);
    } catch {
      logoImage = undefined;
    }
  }
  const writer = new PdfWriter(doc, fontSet, isRtlLocale(locale), branding, logoImage);
  const documentModel = buildDashboardExportDocument(overview, labels, locale, { forPdf: true });

  writer.addTitle(documentModel.title, documentModel.subtitle, documentModel.subtitleParts);

  const metricHeaders: [string, string] = [labels.metric, labels.value];
  for (const section of documentModel.sections) {
    renderSection(writer, section, metricHeaders);
  }

  return doc.save();
}
