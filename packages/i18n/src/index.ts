export type Locale = 'ar-SY' | 'en-US';
export type Direction = 'rtl' | 'ltr';

export interface I18nMessages {
  [key: string]: string | I18nMessages;
}

export interface I18nConfig {
  locale: Locale;
  messages: Record<Locale, I18nMessages>;
}

/** Default localStorage key used when a caller does not provide its own. */
const LOCALE_STORAGE_KEY = 'booking.locale';
const DEFAULT_LOCALE: Locale = 'en-US';

function isSupportedLocale(value: unknown): value is Locale {
  return value === 'ar-SY' || value === 'en-US';
}

export function getDirection(locale: Locale): Direction {
  return locale === 'ar-SY' ? 'rtl' : 'ltr';
}

/**
 * Reads a persisted locale preference from `localStorage`.
 *
 * `storageKey` defaults to the package-wide `LOCALE_STORAGE_KEY`
 * (`'booking.locale'`) for backward compatibility with existing callers
 * (e.g. clinic-dashboard). Callers that need an isolated preference — e.g.
 * Super Admin, which must never read or write the shared clinic key — should
 * pass their own dedicated key. Invalid, unsupported, or missing values
 * always fall back to `DEFAULT_LOCALE`.
 */
export function loadStoredLocale(storageKey: string = LOCALE_STORAGE_KEY): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const stored = localStorage.getItem(storageKey);
    return isSupportedLocale(stored) ? stored : DEFAULT_LOCALE;
  } catch {
    return DEFAULT_LOCALE;
  }
}

/**
 * Persists a locale preference to `localStorage` under `storageKey`
 * (defaults to `LOCALE_STORAGE_KEY` for backward compatibility).
 */
export function persistLocale(locale: Locale, storageKey: string = LOCALE_STORAGE_KEY): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(storageKey, locale);
  } catch {
    /* storage may be unavailable (private browsing, quota) — locale still applies in-memory */
  }
}

function resolve(messages: I18nMessages, key: string): string | undefined {
  const parts = key.split('.');
  let current: string | I18nMessages | undefined = messages;
  for (const part of parts) {
    if (typeof current !== 'object' || current === null) return undefined;
    current = current[part];
  }
  return typeof current === 'string' ? current : undefined;
}

export interface CreateTranslatorOptions {
  /**
   * Used instead of the raw key when both the active locale and the
   * `en-US` fallback locale are missing a translation, and the caller did
   * not pass an explicit `fallback` to `t()`. Leave unset to preserve the
   * original behavior of falling back to the raw key.
   */
  missingFallback?: string;
}

export function createTranslator(
  messages: Record<Locale, I18nMessages>,
  locale: Locale,
  options?: CreateTranslatorOptions,
) {
  return (key: string, fallback?: string): string => {
    return (
      resolve(messages[locale], key) ??
      resolve(messages['en-US'], key) ??
      fallback ??
      options?.missingFallback ??
      key
    );
  };
}

export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY };
