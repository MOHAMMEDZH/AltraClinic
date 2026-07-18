import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import type { DashboardPdfFontBundle } from './build-dashboard-pdf';

const FONT_CANDIDATES = [
  ['NotoNaskhArabic-Regular.ttf', 'NotoNaskhArabic-Bold.ttf'],
  ['NotoSansArabic-Regular.ttf', 'NotoSansArabic-Bold.ttf'],
] as const;

/** Load Arabic font files from disk (Node.js / API only). */
export function loadArabicFontAssets(): DashboardPdfFontBundle | undefined {
  const assetsDir = join(__dirname, '..', 'assets');
  for (const [regularName, boldName] of FONT_CANDIDATES) {
    const regularPath = join(assetsDir, regularName);
    const boldPath = join(assetsDir, boldName);
    if (existsSync(regularPath) && existsSync(boldPath)) {
      return {
        arabicRegular: readFileSync(regularPath),
        arabicBold: readFileSync(boldPath),
      };
    }
  }
  return undefined;
}
