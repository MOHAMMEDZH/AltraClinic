export function formatCurrency(amount: number, locale: string, currency = 'SYP'): string {
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

export function formatNumber(value: number, locale: string): string {
  return new Intl.NumberFormat(locale).format(value);
}

export function formatTime(iso: string, locale: string): string {
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return locale.startsWith('ar') ? 'الآن' : 'Just now';
  if (minutes < 60) return locale.startsWith('ar') ? `منذ ${minutes} د` : `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return locale.startsWith('ar') ? `منذ ${hours} س` : `${hours}h ago`;
  return formatTime(iso, locale);
}

export function formatWait(seconds: number | null): string {
  if (seconds == null) return '—';
  const m = Math.floor(seconds / 60);
  return `${m}m`;
}

export function deltaPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 100);
}

export function pickLocalizedName(
  locale: string,
  en: string | null | undefined,
  ar: string | null | undefined,
): string {
  if (locale.startsWith('ar') && ar) return ar;
  return en ?? ar ?? '—';
}

export function formatPersonName(
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

export function formatPercent(value: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 }).format(
    value / 100,
  );
}
