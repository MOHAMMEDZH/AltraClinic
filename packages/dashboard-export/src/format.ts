import { stripBidiControls } from './prepare-arabic-pdf-text';

export function formatExportCurrency(amount: number, locale: string, currency = 'SYP'): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(locale)} ${currency}`;
  }
}

/** Latin digits + ASCII currency code — avoids bidi/tofu issues in PDF. */
export function formatExportCurrencyForPdf(amount: number, locale: string, currency = 'SYP'): string {
  const num = new Intl.NumberFormat(pdfNumberLocale(locale), {
    maximumFractionDigits: 0,
  }).format(amount);
  return `${num} ${currency}`;
}

export function formatExportNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatExportNumberForPdf(value: number, locale: string): string {
  return new Intl.NumberFormat(pdfNumberLocale(locale)).format(value);
}

export function formatExportPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    value / 100,
  );
}

export function formatExportPercentForPdf(value: number, locale: string): string {
  return stripBidiControls(
    new Intl.NumberFormat(pdfNumberLocale(locale), {
      style: 'percent',
      maximumFractionDigits: 0,
    }).format(value / 100),
  );
}

function pdfNumberLocale(locale: string): string {
  return locale.startsWith('ar') ? 'ar-SY-u-nu-latn' : locale;
}

export function formatExportDate(isoDate: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(isoDate));
  } catch {
    return isoDate;
  }
}

export function formatExportDateForPdf(isoDate: string, locale: string): string {
  try {
    return stripBidiControls(
      new Intl.DateTimeFormat(pdfNumberLocale(locale), { dateStyle: 'medium' }).format(
        new Date(isoDate),
      ),
    );
  } catch {
    return isoDate.slice(0, 10);
  }
}

export function formatExportDateTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function formatExportDateTimeForPdf(iso: string, locale: string): string {
  const dateLocale = locale.startsWith('ar') ? 'en-GB' : locale;
  return formatExportDateTime(iso, dateLocale);
}

export function pickLocalizedExportName(
  locale: string,
  en: string | null | undefined,
  ar: string | null | undefined,
): string {
  if (locale.startsWith('ar') && ar) return ar;
  return en ?? ar ?? '—';
}

export function formatExportPersonName(
  locale: string,
  firstName: string,
  lastName: string,
  firstNameAr: string | null,
  lastNameAr: string | null,
): string {
  if (locale.startsWith('ar') && (firstNameAr || lastNameAr)) {
    return [firstNameAr ?? firstName, lastNameAr ?? lastName].filter(Boolean).join(' ');
  }
  return `${firstName} ${lastName}`.trim();
}

export function isRtlLocale(locale: string): boolean {
  return locale.startsWith('ar');
}
