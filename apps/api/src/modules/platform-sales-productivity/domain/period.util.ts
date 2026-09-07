/**
 * Flexible Step 26 — UTC calendar-month period bounds.
 * Bound: periodStart <= eventTimestamp < nextPeriodStart (periodEnd).
 */

const PERIOD_KEY_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

export type UtcMonthPeriod = {
  periodKey: string;
  periodTimezone: 'UTC';
  periodStart: Date;
  /** Exclusive end: first instant of the next calendar month (UTC). */
  periodEnd: Date;
};

export function assertPeriodKey(periodKey: string): { year: number; month: number } {
  const key = (periodKey ?? '').trim();
  const match = PERIOD_KEY_REGEX.exec(key);
  if (!match) {
    throw new Error(`Invalid periodKey "${periodKey}"; expected YYYY-MM`);
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  return { year, month };
}

/**
 * UTC month bounds. Leap years: February periodEnd is Mar 1 00:00:00.000Z
 * (e.g. 2024-02 → start 2024-02-01T00:00:00.000Z, end 2024-03-01T00:00:00.000Z).
 */
export function utcMonthPeriod(periodKey: string): UtcMonthPeriod {
  const { year, month } = assertPeriodKey(periodKey);
  const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const periodEnd = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return {
    periodKey: `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`,
    periodTimezone: 'UTC',
    periodStart,
    periodEnd,
  };
}

/** Inclusive/exclusive bound check: periodStart <= t < periodEnd. */
export function isTimestampInPeriod(t: Date, period: UtcMonthPeriod): boolean {
  const ms = t.getTime();
  return ms >= period.periodStart.getTime() && ms < period.periodEnd.getTime();
}

export function formatPeriodKeyUtc(date: Date): string {
  const y = date.getUTCFullYear();
  const m = date.getUTCMonth() + 1;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}`;
}
