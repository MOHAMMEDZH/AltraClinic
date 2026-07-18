import type { DashboardRange } from '../api/dashboard-api';

export interface DashboardCustomRange {
  from: string;
  to: string;
}

const PRESET_RANGES: DashboardRange[] = ['today', '7d', '30d', '90d', 'custom'];
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isDashboardRange(value: string): value is DashboardRange {
  return PRESET_RANGES.includes(value as DashboardRange);
}

export function parseIsoDateParam(raw: string | null): string | null {
  if (!raw || !ISO_DATE.test(raw)) return null;
  const parsed = new Date(`${raw}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? null : raw;
}

export function defaultCustomRange(): DashboardCustomRange {
  const to = new Date();
  const from = new Date();
  from.setUTCDate(from.getUTCDate() - 29);
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) };
}

export function parseDashboardCustomRangeParams(
  fromRaw: string | null,
  toRaw: string | null,
): DashboardCustomRange {
  const from = parseIsoDateParam(fromRaw);
  const to = parseIsoDateParam(toRaw);
  if (from && to && to >= from) return { from, to };
  return defaultCustomRange();
}

export function buildDashboardRangeQuery(
  range: DashboardRange,
  customRange: DashboardCustomRange,
): Record<string, string> {
  const query: Record<string, string> = {};
  if (range !== '7d') query.range = range;
  if (range === 'custom') {
    query.from = customRange.from;
    query.to = customRange.to;
  }
  return query;
}

export const DASHBOARD_PRESET_RANGES: DashboardRange[] = ['today', '7d', '30d', '90d', 'custom'];
