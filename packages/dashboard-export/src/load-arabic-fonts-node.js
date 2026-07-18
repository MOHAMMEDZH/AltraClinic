"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadArabicFontAssets = loadArabicFontAssets;
const fs_1 = require("fs");
const path_1 = require("path");
const FONT_CANDIDATES = [
    ['NotoNaskhArabic-Regular.ttf', 'NotoNaskhArabic-Bold.ttf'],
    ['NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf'],
];
/** Load Arabic font files from disk (Node.js / API only). */
function loadArabicFontAssets() {
    const assetsDir = (0, path_1.join)(__dirname, '..', 'assets');
    for (const [regularName, boldName] of FONT_CANDIDATES) {
        const regularPath = (0, path_1.join)(assetsDir, regularName);
        const boldPath = (0, path_1.join)(assetsDir, boldName);
        if ((0, fs_1.existsSync)(regularPath) && (0, fs_1.existsSync)(boldPath)) {
            return {
                arabicRegular: (0, fs_1.readFileSync)(regularPath),
                arabicBold: (0, fs_1.readFileSync)(boldPath),
            };
        }
    }
    return undefined;
}
