import { shapeArabicVisual } from 'naqqash';

const BIDI_CONTROL = /[\u200E\u200F\u202A-\u202E\u2066-\u2069\u061C\uFEFF]/g;

export function stripBidiControls(text: string): string {
  return text.replace(BIDI_CONTROL, '').replace(/\u00a0/g, ' ').trim();
}

export function containsArabicLetters(text: string): boolean {
  return /[\u0621-\u064A\u066E-\u066F\u0671-\u06D3\u06FA-\u06FF]/.test(text);
}

/** Shape Arabic for pdf-lib (LTR renderer with no bidi support). */
export function prepareArabicPdfText(text: string): string {
  const cleaned = stripBidiControls(text);
  if (!containsArabicLetters(cleaned)) return cleaned;
  return shapeArabicVisual(cleaned);
}
