import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  createTranslator,
  getDirection,
  loadStoredLocale,
  persistLocale,
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

export function I18nProvider({
  messages,
  children,
}: {
  messages: Record<Locale, I18nMessages>;
  children: ReactNode;
}) {
  const [locale, setLocaleState] = useState<Locale>(() => loadStoredLocale());

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = getDirection(locale);
  }, [locale]);

  const setLocale = useCallback((next: Locale) => {
    persistLocale(next);
    setLocaleState(next);
    document.documentElement.lang = next;
    document.documentElement.dir = getDirection(next);
  }, []);

  const value = useMemo<I18nContextValue>(() => {
    const t = createTranslator(messages, locale);
    return { locale, direction: getDirection(locale), t, setLocale };
  }, [locale, messages]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}
