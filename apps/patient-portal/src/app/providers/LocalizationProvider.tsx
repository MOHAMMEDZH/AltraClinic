import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  formatPortalDate,
  resolvePortalLocale,
  t,
  type PortalLocale,
} from '../../i18n/messages';
import { usePortalConfig } from './ConfigProvider';

interface I18nContextValue {
  locale: PortalLocale;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
  formatDate: (value: Date, timeZone?: string) => string;
  dir: 'ltr' | 'rtl';
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function LocalizationProvider({ children }: { children: ReactNode }) {
  const { config } = usePortalConfig();
  const [locale, setLocaleState] = useState<PortalLocale>(() =>
    resolvePortalLocale(config.defaultLocale),
  );

  useEffect(() => {
    document.documentElement.lang = locale === 'ar' ? 'ar' : 'en-US';
    document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr';
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (next) => setLocaleState(resolvePortalLocale(next)),
      t: (key) => t(locale, key),
      formatDate: (value, timeZone) => formatPortalDate(value, locale, timeZone),
      dir: locale === 'ar' ? 'rtl' : 'ltr',
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function usePortalI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    throw new Error('usePortalI18n must be used within LocalizationProvider');
  }
  return ctx;
}
