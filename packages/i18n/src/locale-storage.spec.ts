import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  createTranslator,
  DEFAULT_LOCALE,
  getDirection,
  loadStoredLocale,
  LOCALE_STORAGE_KEY,
  persistLocale,
} from './index';

function stubStorage(store: Record<string, string>) {
  vi.stubGlobal('window', {});
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = value;
    },
  });
}

describe('i18n storage-key configurability', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('defaults to the shared booking.locale key when no storageKey is provided', () => {
    expect(LOCALE_STORAGE_KEY).toBe('booking.locale');
    const store: Record<string, string> = { 'booking.locale': 'ar-SY' };
    stubStorage(store);

    expect(loadStoredLocale()).toBe('ar-SY');
  });

  it('reads from a custom storage key and ignores the default key', () => {
    const store: Record<string, string> = {
      'booking.locale': 'ar-SY',
      'booking.super-admin.locale': 'en-US',
    };
    stubStorage(store);

    expect(loadStoredLocale('booking.super-admin.locale')).toBe('en-US');
  });

  it('falls back to DEFAULT_LOCALE for a custom key with nothing stored', () => {
    stubStorage({});
    expect(loadStoredLocale('booking.super-admin.locale')).toBe(DEFAULT_LOCALE);
  });

  it('falls back to DEFAULT_LOCALE for an invalid/unsupported stored value under a custom key', () => {
    const store: Record<string, string> = { 'booking.super-admin.locale': 'fr-FR' };
    stubStorage(store);
    expect(loadStoredLocale('booking.super-admin.locale')).toBe(DEFAULT_LOCALE);
  });

  it('falls back to DEFAULT_LOCALE for an invalid stored value under the default key', () => {
    const store: Record<string, string> = { 'booking.locale': 'not-a-locale' };
    stubStorage(store);
    expect(loadStoredLocale()).toBe(DEFAULT_LOCALE);
  });

  it('persists to the default key when no storageKey is provided', () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    persistLocale('ar-SY');
    expect(store['booking.locale']).toBe('ar-SY');
  });

  it('persists to a custom storage key only, never touching the default key', () => {
    const store: Record<string, string> = {};
    stubStorage(store);
    persistLocale('ar-SY', 'booking.super-admin.locale');
    expect(store['booking.super-admin.locale']).toBe('ar-SY');
    expect(store['booking.locale']).toBeUndefined();
  });

  it('getDirection still reflects the resolved locale regardless of key', () => {
    expect(getDirection('ar-SY')).toBe('rtl');
    expect(getDirection('en-US')).toBe('ltr');
  });

  it('createTranslator falls back to the raw key by default when both locales miss a translation', () => {
    const t = createTranslator({ 'en-US': {}, 'ar-SY': {} }, 'en-US');
    expect(t('missing.key')).toBe('missing.key');
  });

  it('createTranslator uses an explicit fallback argument over the raw key', () => {
    const t = createTranslator({ 'en-US': {}, 'ar-SY': {} }, 'en-US');
    expect(t('missing.key', 'Fallback text')).toBe('Fallback text');
  });

  it('createTranslator uses missingFallback option when set and no explicit fallback is given', () => {
    const t = createTranslator({ 'en-US': {}, 'ar-SY': {} }, 'en-US', { missingFallback: '…' });
    expect(t('missing.key')).toBe('…');
  });

  it('createTranslator still prefers an explicit fallback over missingFallback', () => {
    const t = createTranslator({ 'en-US': {}, 'ar-SY': {} }, 'en-US', { missingFallback: '…' });
    expect(t('missing.key', 'Explicit')).toBe('Explicit');
  });

  it('createTranslator resolves from the active locale before falling back to en-US', () => {
    const t = createTranslator(
      { 'en-US': { greeting: 'Hello' }, 'ar-SY': { greeting: 'مرحبا' } },
      'ar-SY',
    );
    expect(t('greeting')).toBe('مرحبا');
  });

  it('createTranslator falls back to en-US when the active locale is missing a key', () => {
    const t = createTranslator(
      { 'en-US': { greeting: 'Hello' }, 'ar-SY': {} },
      'ar-SY',
    );
    expect(t('greeting')).toBe('Hello');
  });
});
