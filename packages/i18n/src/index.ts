export type Locale = 'ar-SY' | 'en-US';
export type Direction = 'rtl' | 'ltr';

export interface I18nMessages {
  [key: string]: string | I18nMessages;
}

export interface I18nConfig {
  locale: Locale;
  messages: Record<Locale, I18nMessages>;
}

const LOCALE_STORAGE_KEY = 'booking.locale';
const DEFAULT_LOCALE: Locale = 'en-US';

export function getDirection(locale: Locale): Direction {
  return locale === 'ar-SY' ? 'rtl' : 'ltr';
}

export function loadStoredLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
  if (stored === 'ar-SY' || stored === 'en-US') return stored;
  return DEFAULT_LOCALE;
}

export function persistLocale(locale: Locale): void {
  localStorage.setItem(LOCALE_STORAGE_KEY, locale);
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

export function createTranslator(messages: Record<Locale, I18nMessages>, locale: Locale) {
  return (key: string, fallback?: string): string => {
    return (
      resolve(messages[locale], key) ??
      resolve(messages['en-US'], key) ??
      fallback ??
      key
    );
  };
}

export { DEFAULT_LOCALE, LOCALE_STORAGE_KEY };
