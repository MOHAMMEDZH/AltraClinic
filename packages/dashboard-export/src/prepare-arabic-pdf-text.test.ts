import { describe, expect, it } from 'vitest';
import { containsArabicLetters, prepareArabicPdfText, stripBidiControls } from './prepare-arabic-pdf-text';

describe('prepare-arabic-pdf-text', () => {
  it('strips invisible bidi control characters', () => {
    expect(stripBidiControls('\u200F1,500\u00a0ل.س.\u200F')).toBe('1,500 ل.س.');
  });

  it('shapes Arabic words for visual LTR rendering', () => {
    const shaped = prepareArabicPdfText('لوحة التحكم');
    expect(shaped).not.toBe('لوحة التحكم');
    expect(shaped.length).toBeGreaterThan(0);
  });

  it('passes through latin-only values unchanged', () => {
    expect(prepareArabicPdfText('1,500 SYP')).toBe('1,500 SYP');
    expect(prepareArabicPdfText('72%')).toBe('72%');
  });
});
