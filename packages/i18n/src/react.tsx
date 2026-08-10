import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  createTranslator,
  getDirection,
  loadStoredLocale,
  persistLocale,
  LOCALE_STORAGE_KEY,
  type CreateTranslatorOptions,
  type I18nMessages,
  type Locale,
} from './index';

interface I18nContextValue {
  locale: Locale;
  direction: 'rtl' | 'ltr';
  t: (key: string, fallback?: string) => string;
  setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function isSupportedLocale(value: unknown): value is Locale {
  return value === 'ar-SY' || value === 'en-US';
}

export function I18nProvider({
  messages,
  children,
  storageKey = LOCALE_STORAGE_KEY,
  missingFallback,
}: {
  messages: Record<Locale, I18nMessages>;
  children: ReactNode;
  /**
   * localStorage key used to persist/load the locale preference. Defaults to
   * the shared `LOCALE_STORAGE_KEY` (`'booking.locale'`) for backward
   * compatibility. Apps that must keep their locale preference isolated
   * (e.g. Super Admin) should pass a dedicated key here — this provider
   * never reads or writes any key other than the one it's given.
   */
  storageKey?: string;
  /** Forwarded to `createTranslator` — see `CreateTranslatorOptions`. */
  missingFallback?: CreateTranslatorOptions['missingFallback'];
}) {
  const storageKeyRef = useRef(storageKey);
  storageKeyRef.current = storageKey;

  const [locale, setLocaleState] = useState<Locale>(() => loadStoredLocale(storageKey));

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next, storageKeyRef.current);
    setLocaleState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = getDirection(next);
  }, []);

  // Only react to storage events for the configured key — never fall back to
  // the shared `booking.locale` key when a custom `storageKey` is in use.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    function onStorage(event: StorageEvent) {
      if (event.key !== storageKeyRef.current) return;
      const next = isSupportedLocale(event.newValue) ? event.newValue : null;
      if (next) setLocaleState(next);
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = createTranslator(messages, locale, missingFallback !== undefined ? { missingFallback } : undefined);
    return { locale, direction: getDirection(locale), t, setLocale };
  }, [locale, messages, missingFallback, setLocale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
