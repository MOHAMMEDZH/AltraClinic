"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildDashboardWordBuffer = buildDashboardWordBuffer;
const docx_1 = require("docx");
const build_dashboard_sections_1 = require("./build-dashboard-sections");
const format_1 = require("./format");
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
    top: { style: docx_1.BorderStyle.SINGLE, size: 1, color: COLORS.border },
    bottom: { style: docx_1.BorderStyle.SINGLE, size: 1, color: COLORS.border },
    left: { style: docx_1.BorderStyle.SINGLE, size: 1, color: COLORS.border },
    right: { style: docx_1.BorderStyle.SINGLE, size: 1, color: COLORS.border },
};
function bodyFont(isRtl) {
    return isRtl ? 'Arial' : 'Calibri';
}
function textRun(text, isRtl, options = {}) {
    return new docx_1.TextRun({
        text,
        font: bodyFont(isRtl),
        bold: options.bold ?? false,
        size: (options.size ?? 11) * 2,
        color: options.color ?? COLORS.text,
        rightToLeft: isRtl,
    });
}
function paragraph(text, isRtl, options = {}) {
    return new docx_1.Paragraph({
        bidirectional: isRtl,
        alignment: isRtl ? docx_1.AlignmentType.RIGHT : docx_1.AlignmentType.LEFT,
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
function dataCell(text, isRtl, options = {}) {
    return new docx_1.TableCell({
        borders: thinBorder,
        shading: options.fill
            ? { fill: options.fill, type: docx_1.ShadingType.CLEAR, color: 'auto' }
            : undefined,
        verticalAlign: docx_1.VerticalAlign.CENTER,
        children: [
            paragraph(text, isRtl, {
                bold: options.bold,
                color: options.color,
            }),
        ],
    });
}
class WordWriter {
    constructor(isRtl) {
        this.isRtl = isRtl;
        this.blocks = [];
    }
    addTitle(title, subtitle) {
        this.blocks.push(paragraph(title, this.isRtl, { bold: true, color: COLORS.primary, size: 16, spacingAfter: 120 }), paragraph(subtitle, this.isRtl, { color: COLORS.muted, size: 10, spacingAfter: 240 }));
    }
    sectionHeaderRow(title, colSpan) {
        return new docx_1.TableRow({
            children: [
                new docx_1.TableCell({
                    columnSpan: colSpan,
                    borders: thinBorder,
                    shading: { fill: COLORS.primary, type: docx_1.ShadingType.CLEAR, color: 'auto' },
                    verticalAlign: docx_1.VerticalAlign.CENTER,
                    children: [paragraph(title, this.isRtl, { bold: true, color: COLORS.white, size: 12 })],
                }),
            ],
        });
    }
    headerRow(headers) {
        return new docx_1.TableRow({
            children: headers.map((header) => dataCell(header, this.isRtl, {
                bold: true,
                fill: COLORS.primaryLight,
                color: COLORS.primary,
            })),
        });
    }
    dataRow(values, stripe) {
        return new docx_1.TableRow({
            children: values.map((value) => dataCell(value, this.isRtl, { fill: stripe ? COLORS.zebra : undefined })),
        });
    }
    addTable(title, headers, rows) {
        if (rows.length === 0)
            return;
        const tableRows = [
            this.sectionHeaderRow(title, headers.length),
            this.headerRow(headers),
            ...rows.map((row, index) => this.dataRow(row, index % 2 === 1)),
        ];
        this.blocks.push(new docx_1.Table({
            visuallyRightToLeft: this.isRtl,
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            rows: tableRows,
        }));
    }
    addMetricsSection(title, headers, rows) {
        this.addTable(title, headers, rows);
    }
    addTableSection(title, headers, rows) {
        this.addTable(title, headers, rows);
    }
    build() {
        return this.blocks;
    }
}
function renderSection(writer, section, metricHeaders) {
    if (section.kind === 'metrics') {
        writer.addMetricsSection(section.title, metricHeaders, section.rows);
        return;
    }
    writer.addTableSection(section.title, section.headers, section.rows);
}
/** Build a styled Word document (.docx) with native RTL Arabic support. */
async function buildDashboardWordBuffer(overview, labels, locale) {
    const isRtl = (0, format_1.isRtlLocale)(locale);
    const documentModel = (0, build_dashboard_sections_1.buildDashboardExportDocument)(overview, labels, locale);
    const writer = new WordWriter(isRtl);
    writer.addTitle(documentModel.title, documentModel.subtitle);
    const metricHeaders = [labels.metric, labels.value];
    for (const section of documentModel.sections) {
        renderSection(writer, section, metricHeaders);
    }
    const doc = new docx_1.Document({
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
    return docx_1.Packer.toArrayBuffer(doc);
}
