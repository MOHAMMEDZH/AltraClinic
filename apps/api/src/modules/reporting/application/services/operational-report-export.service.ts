import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import type { OperationalReportRows } from './operational-report-data.service';

/** Minimal XLSX (Office Open XML) writer for tabular operational exports. */
export async function buildOperationalExcel(data: OperationalReportRows): Promise<Buffer> {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(data.title.slice(0, 31));
  sheet.addRow(data.headers);
  for (const row of data.rows) {
    sheet.addRow(row);
  }
  sheet.getRow(1).font = { bold: true };
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function buildOperationalPdf(
  data: OperationalReportRows,
  title: string,
  branding?: { clinicName?: string; logoBytes?: Uint8Array; logoMimeType?: string },
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  let page = doc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - margin;
  const primary = rgb(0.082, 0.419, 0.337);
  let pageNum = 1;

  let logoImage: Awaited<ReturnType<typeof doc.embedPng>> | undefined;
  if (branding?.logoBytes?.length) {
    try {
      logoImage = branding.logoMimeType?.includes('png')
        ? await doc.embedPng(branding.logoBytes)
        : await doc.embedJpg(branding.logoBytes);
    } catch {
      logoImage = undefined;
    }
  }

  const drawFooter = () => {
    page.drawText(`Page ${pageNum}`, {
      x: pageWidth - margin - 50,
      y: 20,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    if (branding?.clinicName) {
      page.drawText(branding.clinicName, { x: margin, y: 20, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    }
  };

  if (logoImage) {
    const logoHeight = 36;
    const scale = logoHeight / logoImage.height;
    const logoWidth = logoImage.width * scale;
    page.drawImage(logoImage, { x: margin, y: y - logoHeight, width: logoWidth, height: logoHeight });
    y -= logoHeight + 10;
  }

  page.drawText(branding?.clinicName ? `${branding.clinicName} — ${title}` : title, {
    x: margin,
    y,
    size: 14,
    font: bold,
    color: primary,
  });
  y -= 28;
  page.drawText(data.title, { x: margin, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
  y -= 24;

  const colWidth = (pageWidth - margin * 2) / Math.max(data.headers.length, 1);

  const ensureSpace = (needed: number) => {
    if (y - needed < margin + 30) {
      drawFooter();
      page = doc.addPage([pageWidth, pageHeight]);
      pageNum++;
      y = pageHeight - margin;
    }
  };

  ensureSpace(20);
  data.headers.forEach((header, i) => {
    page.drawText(header.slice(0, 18), {
      x: margin + i * colWidth,
      y,
      size: 9,
      font: bold,
      color: primary,
    });
  });
  y -= 16;

  for (const row of data.rows) {
    ensureSpace(14);
    row.forEach((cell, i) => {
      page.drawText(String(cell).slice(0, 22), {
        x: margin + i * colWidth,
        y,
        size: 8,
        font,
      });
    });
    y -= 12;
  }

  drawFooter();
  return doc.save();
}
