export type DashboardRange = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DashboardTrendWindow {
  range: DashboardRange;
  trendStart: Date;
  trendDays: number;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function parseDashboardRange(raw?: string): DashboardRange {
  if (raw === 'today' || raw === '30d' || raw === '90d' || raw === 'custom') return raw;
  return '7d';
}

function parseIsoDateOnly(raw: string): Date | null {
  if (!ISO_DATE.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function utcDayDiff(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function resolveTrendWindow(
  startOfDay: Date,
  range: DashboardRange,
  from?: string,
  to?: string,
): DashboardTrendWindow {
  if (range === 'custom') {
    const start = from ? parseIsoDateOnly(from.trim()) : null;
    const end = to ? parseIsoDateOnly(to.trim()) : null;
    if (start && end && end >= start) {
      const days = Math.min(Math.max(utcDayDiff(start, end) + 1, 1), 366);
      return { range: 'custom', trendStart: start, trendDays: days };
    }
    range = '30d';
  }

  return {
    range,
    trendStart: trendStartDate(startOfDay, range),
    trendDays: trendDayCount(range),
  };
}

export function trendDayCount(range: Exclude<DashboardRange, 'custom'>): number {
  switch (range) {
    case 'today':
      return 1;
    case '30d':
      return 30;
    case '90d':
      return 90;
    default:
      return 7;
  }
}

export function trendStartDate(startOfDay: Date, range: Exclude<DashboardRange, 'custom'>): Date {
  const trendStart = new Date(startOfDay);
  trendStart.setUTCDate(trendStart.getUTCDate() - (trendDayCount(range) - 1));
  return trendStart;
}

export function buildUtcDateSeries(start: Date, days: number): string[] {
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(start);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}
