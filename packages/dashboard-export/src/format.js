"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatExportCurrency = formatExportCurrency;
exports.formatExportCurrencyForPdf = formatExportCurrencyForPdf;
exports.formatExportNumber = formatExportNumber;
exports.formatExportNumberForPdf = formatExportNumberForPdf;
exports.formatExportPercent = formatExportPercent;
exports.formatExportPercentForPdf = formatExportPercentForPdf;
exports.formatExportDate = formatExportDate;
exports.formatExportDateForPdf = formatExportDateForPdf;
exports.formatExportDateTime = formatExportDateTime;
exports.formatExportDateTimeForPdf = formatExportDateTimeForPdf;
exports.pickLocalizedExportName = pickLocalizedExportName;
exports.formatExportPersonName = formatExportPersonName;
exports.isRtlLocale = isRtlLocale;
const prepare_arabic_pdf_text_1 = require("./prepare-arabic-pdf-text");
function formatExportCurrency(amount, locale, currency = 'SYP') {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency,
            maximumFractionDigits: 0,
        }).format(amount);
    }
    catch {
        return `${amount.toLocaleString(locale)} ${currency}`;
    }
}
/** Latin digits + ASCII currency code — avoids bidi/tofu issues in PDF. */
function formatExportCurrencyForPdf(amount, locale, currency = 'SYP') {
    const num = new Intl.NumberFormat(pdfNumberLocale(locale), {
        maximumFractionDigits: 0,
    }).format(amount);
    return `${num} ${currency}`;
}
function formatExportNumber(value, locale) {
    return new Intl.NumberFormat(locale).format(value);
}
function formatExportNumberForPdf(value, locale) {
    return new Intl.NumberFormat(pdfNumberLocale(locale)).format(value);
}
function formatExportPercent(value, locale) {
    return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(value / 100);
}
function formatExportPercentForPdf(value, locale) {
    return (0, prepare_arabic_pdf_text_1.stripBidiControls)(new Intl.NumberFormat(pdfNumberLocale(locale), {
        style: 'percent',
        maximumFractionDigits: 0,
    }).format(value / 100));
}
function pdfNumberLocale(locale) {
    return locale.startsWith('ar') ? 'ar-SY-u-nu-latn' : locale;
}
function formatExportDate(isoDate, locale) {
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(isoDate));
    }
    catch {
        return isoDate;
    }
}
function formatExportDateForPdf(isoDate, locale) {
    try {
        return (0, prepare_arabic_pdf_text_1.stripBidiControls)(new Intl.DateTimeFormat(pdfNumberLocale(locale), { dateStyle: 'medium' }).format(new Date(isoDate)));
    }
    catch {
        return isoDate.slice(0, 10);
    }
}
function formatExportDateTime(iso, locale) {
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
    }
    catch {
        return iso;
    }
}
function formatExportDateTimeForPdf(iso, locale) {
    const dateLocale = locale.startsWith('ar') ? 'en-GB' : locale;
    return formatExportDateTime(iso, dateLocale);
}
function pickLocalizedExportName(locale, en, ar) {
    if (locale.startsWith('ar') && ar)
        return ar;
    return en ?? ar ?? '—';
}
function formatExportPersonName(locale, firstName, lastName, firstNameAr, lastNameAr) {
    if (locale.startsWith('ar') && (firstNameAr || lastNameAr)) {
        return [firstNameAr ?? firstName, lastNameAr ?? lastName].filter(Boolean).join(' ');
    }
    return `${firstName} ${lastName}`.trim();
}
function isRtlLocale(locale) {
    return locale.startsWith('ar');
}
