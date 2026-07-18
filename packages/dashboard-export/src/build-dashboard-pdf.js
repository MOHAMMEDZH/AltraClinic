"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardPdfBytes = buildDashboardPdfBytes;
const pdf_lib_1 = require("pdf-lib");
const fontkit_1 = __importDefault(require("@pdf-lib/fontkit"));
const build_dashboard_sections_1 = require("./build-dashboard-sections");
const format_1 = require("./format");
const prepare_arabic_pdf_text_1 = require("./prepare-arabic-pdf-text");
const PAGE_WIDTH = 595;
const PAGE_HEIGHT = 842;
const MARGIN = 40;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const CELL_PADDING = 6;
const COLORS = {
    primary: (0, pdf_lib_1.rgb)(0.082, 0.419, 0.337),
    primaryLight: (0, pdf_lib_1.rgb)(0.909, 0.961, 0.945),
    text: (0, pdf_lib_1.rgb)(0.122, 0.161, 0.216),
    muted: (0, pdf_lib_1.rgb)(0.42, 0.447, 0.502),
    white: (0, pdf_lib_1.rgb)(1, 1, 1),
    zebra: (0, pdf_lib_1.rgb)(0.976, 0.98, 0.984),
    border: (0, pdf_lib_1.rgb)(0.816, 0.835, 0.867),
};
function toUint8Array(data) {
    return data instanceof Uint8Array ? data : new Uint8Array(data);
}
function orderForRtl(items, isRtl) {
    return isRtl ? [...items].reverse() : [...items];
}
class PdfWriter {
    constructor(doc, fonts, isRtl, branding, logoImage) {
        this.doc = doc;
        this.fonts = fonts;
        this.isRtl = isRtl;
        this.branding = branding;
        this.logoImage = logoImage;
        this.y = PAGE_HEIGHT - MARGIN;
        this.pageIndex = 1;
        this.page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        this.drawPageFooter();
    }
    drawPageFooter() {
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
    get arabicEnabled() {
        return this.isRtl && Boolean(this.fonts.arabicRegular);
    }
    pickLatinFont(bold) {
        return bold ? this.fonts.bold : this.fonts.regular;
    }
    pickArabicFont(bold) {
        if (bold && this.fonts.arabicBold)
            return this.fonts.arabicBold;
        return this.fonts.arabicRegular ?? this.pickLatinFont(bold);
    }
    ensureSpace(height) {
        if (this.y - height >= MARGIN + 36)
            return;
        this.page = this.doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        this.pageIndex++;
        this.y = PAGE_HEIGHT - MARGIN;
        this.drawPageFooter();
    }
    drawLatinText(text, x, y, size, bold = false, color = COLORS.text, cellWidth) {
        const display = (0, prepare_arabic_pdf_text_1.stripBidiControls)(text);
        const font = this.pickLatinFont(bold);
        const textWidth = font.widthOfTextAtSize(display, size);
        let drawX = x;
        if (cellWidth !== undefined) {
            drawX = this.isRtl ? x + cellWidth - textWidth - CELL_PADDING : x + CELL_PADDING;
        }
        this.page.drawText(display, { x: drawX, y, size, font, color });
    }
    drawArabicTextLine(text, x, y, size, bold = false, color = COLORS.text, cellWidth) {
        const font = this.pickArabicFont(bold);
        const display = (0, prepare_arabic_pdf_text_1.prepareArabicPdfText)(text);
        const textWidth = font.widthOfTextAtSize(display, size);
        let drawX = x;
        if (cellWidth !== undefined) {
            drawX = this.isRtl ? x + cellWidth - textWidth - CELL_PADDING : x + CELL_PADDING;
        }
        else if (this.isRtl) {
            drawX = x + CONTENT_WIDTH - textWidth;
        }
        this.page.drawText(display, { x: drawX, y, size, font, color });
    }
    drawText(text, x, y, size, bold = false, color = COLORS.text, cellWidth) {
        if (this.arabicEnabled && (0, prepare_arabic_pdf_text_1.containsArabicLetters)(text)) {
            this.drawArabicTextLine(text, x, y, size, bold, color, cellWidth);
            return;
        }
        this.drawLatinText(text, x, y, size, bold, color, cellWidth);
    }
    addTitle(title, subtitle, subtitleParts) {
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
            this.drawArabicTextLine(subtitleParts.label, MARGIN, lineY, 10, false, COLORS.muted, CONTENT_WIDTH);
        }
        else {
            this.drawText(subtitle, MARGIN, this.y, 10, false, COLORS.muted, CONTENT_WIDTH);
        }
        this.y -= 20;
    }
    drawSectionHeader(title) {
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
    drawTableHeader(headers, colWidths) {
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
    drawTableRow(values, colWidths, stripe) {
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
    addMetricsSection(title, headers, rows) {
        this.drawSectionHeader(title);
        const colWidths = [CONTENT_WIDTH * 0.58, CONTENT_WIDTH * 0.42];
        this.drawTableHeader(headers, colWidths);
        rows.forEach(([metric, value], index) => {
            this.drawTableRow([metric, value], colWidths, index % 2 === 1);
        });
        this.y -= 8;
    }
    addTableSection(title, headers, rows) {
        if (rows.length === 0)
            return;
        this.drawSectionHeader(title);
        const colWidths = headers.length === 3
            ? [CONTENT_WIDTH * 0.46, CONTENT_WIDTH * 0.27, CONTENT_WIDTH * 0.27]
            : [CONTENT_WIDTH * 0.58, CONTENT_WIDTH * 0.42];
        this.drawTableHeader(headers, colWidths);
        rows.forEach((row, index) => {
            this.drawTableRow(row, colWidths, index % 2 === 1);
        });
        this.y -= 8;
    }
}
async function embedFonts(doc, fonts) {
    const regular = await doc.embedFont(pdf_lib_1.StandardFonts.Helvetica);
    const bold = await doc.embedFont(pdf_lib_1.StandardFonts.HelveticaBold);
    const bundle = fonts ?? undefined;
    if (!bundle?.arabicRegular || !bundle?.arabicBold) {
        return { regular, bold };
    }
    doc.registerFontkit(fontkit_1.default);
    return {
        regular,
        bold,
        arabicRegular: await doc.embedFont(toUint8Array(bundle.arabicRegular), { subset: false }),
        arabicBold: await doc.embedFont(toUint8Array(bundle.arabicBold), { subset: false }),
    };
}
function renderSection(writer, section, metricHeaders) {
    if (section.kind === 'metrics') {
        writer.addMetricsSection(section.title, metricHeaders, section.rows);
        return;
    }
    writer.addTableSection(section.title, section.headers, section.rows);
}
/** Build a styled PDF report matching the Excel export layout. */
async function buildDashboardPdfBytes(overview, labels, locale, fonts, branding) {
    const doc = await pdf_lib_1.PDFDocument.create();
    doc.setTitle(labels.title);
    doc.setCreator(branding?.clinicName ? `${branding.clinicName} — Booking System` : 'Booking System');
    const fontSet = await embedFonts(doc, fonts);
    let logoImage;
    if (branding?.logoBytes?.length) {
        try {
            logoImage = branding.logoMimeType?.includes('png')
                ? await doc.embedPng(branding.logoBytes)
                : await doc.embedJpg(branding.logoBytes);
        }
        catch {
            logoImage = undefined;
        }
    }
    const writer = new PdfWriter(doc, fontSet, (0, format_1.isRtlLocale)(locale), branding, logoImage);
    const documentModel = (0, build_dashboard_sections_1.buildDashboardExportDocument)(overview, labels, locale, { forPdf: true });
    writer.addTitle(documentModel.title, documentModel.subtitle, documentModel.subtitleParts);
    const metricHeaders = [labels.metric, labels.value];
    for (const section of documentModel.sections) {
        renderSection(writer, section, metricHeaders);
    }
    return doc.save();
}
