import { describe, expect, it, vi, afterEach } from 'vitest';
import { DEFAULT_LOCALE, getDirection, loadStoredLocale, LOCALE_STORAGE_KEY } from '@booking/i18n';

describe('i18n defaults', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to English', () => {
    expect(DEFAULT_LOCALE).toBe('en-US');
    expect(getDirection(DEFAULT_LOCALE)).toBe('ltr');
    expect(getDirection('ar-SY')).toBe('rtl');
  });

  it('loads stored Arabic preference', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => (key === LOCALE_STORAGE_KEY ? 'ar-SY' : null),
      setItem: vi.fn(),
    });

    expect(loadStoredLocale()).toBe('ar-SY');
  });

  it('falls back to English when nothing is stored', () => {
    vi.stubGlobal('window', {});
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: vi.fn(),
    });

    expect(loadStoredLocale()).toBe('en-US');
  });
});
