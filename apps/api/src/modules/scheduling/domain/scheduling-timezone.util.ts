import { DateTime } from 'luxon';
import type { DayWindow } from '../application/services/schedule-window.service';

const DATE_YMD = /^\d{4}-\d{2}-\d{2}$/;

export function normalizeTimezone(timezone?: string | null): string {
  const candidate = timezone?.trim() || 'UTC';
  try {
    Intl.DateTimeFormat(undefined, { timeZone: candidate });
    return candidate;
  } catch {
    return 'UTC';
  }
}

export function assertDateYmd(dateYmd: string): void {
  if (!DATE_YMD.test(dateYmd)) {
    throw new Error('date must be YYYY-MM-DD');
  }
}

/** JavaScript weekday (0=Sun … 6=Sat) for a calendar date in the given IANA timezone. */
export function dayOfWeekInTimezone(dateYmd: string, timezone: string): number {
  assertDateYmd(dateYmd);
  const zone = normalizeTimezone(timezone);
  const dt = DateTime.fromISO(dateYmd, { zone });
  if (!dt.isValid) throw new Error('Invalid date');
  return dt.weekday === 7 ? 0 : dt.weekday;
}

/** UTC instants for local day bounds (00:00–23:59:59.999) in the clinic timezone. */
export function zonedDayBoundsUtc(
  dateYmd: string,
  timezone: string,
): { start: Date; end: Date } {
  assertDateYmd(dateYmd);
  const zone = normalizeTimezone(timezone);
  const start = DateTime.fromISO(dateYmd, { zone }).startOf('day');
  const end = DateTime.fromISO(dateYmd, { zone }).endOf('day');
  if (!start.isValid || !end.isValid) throw new Error('Invalid date');
  return { start: start.toJSDate(), end: end.toJSDate() };
}

export function applyWindowToZonedDay(
  dateYmd: string,
  timezone: string,
  window: DayWindow,
): { rangeStart: Date; rangeEnd: Date } | null {
  if (window.isClosed) return null;

  assertDateYmd(dateYmd);
  const zone = normalizeTimezone(timezone);
  const rangeStart = DateTime.fromISO(dateYmd, { zone }).set({
    hour: window.startHour,
    minute: window.startMin,
    second: 0,
    millisecond: 0,
  });
  const rangeEnd = DateTime.fromISO(dateYmd, { zone }).set({
    hour: window.endHour,
    minute: window.endMin,
    second: 0,
    millisecond: 0,
  });

  if (!rangeStart.isValid || !rangeEnd.isValid || rangeStart >= rangeEnd) return null;
  return { rangeStart: rangeStart.toJSDate(), rangeEnd: rangeEnd.toJSDate() };
}
