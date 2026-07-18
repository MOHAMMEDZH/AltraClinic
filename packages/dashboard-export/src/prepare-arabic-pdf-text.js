"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripBidiControls = stripBidiControls;
exports.containsArabicLetters = containsArabicLetters;
exports.prepareArabicPdfText = prepareArabicPdfText;
const naqqash_1 = require("naqqash");
const BIDI_CONTROL = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g;
function stripBidiControls(text) {
    return text.replace(BIDI_CONTROL, '').replace(/\u00a0/g, ' ').trim();
}
function containsArabicLetters(text) {
    return /[\u0621-\u064A\u066E-\u066F\u0671-\u06D3\u06FA-\u06FF]/.test(text);
}
/** Shape Arabic for pdf-lib (LTR renderer with no bidi support). */
function prepareArabicPdfText(text) {
    const cleaned = stripBidiControls(text);
    if (!containsArabicLetters(cleaned))
        return cleaned;
    return (0, naqqash_1.shapeArabicVisual)(cleaned);
}
