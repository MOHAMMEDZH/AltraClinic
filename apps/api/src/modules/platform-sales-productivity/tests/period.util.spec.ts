/**
 * Flexible Step 26 — UTC month period utility unit tests (T01–T07 subset without DB).
 */
import {
  assertPeriodKey,
  formatPeriodKeyUtc,
  isTimestampInPeriod,
  utcMonthPeriod,
} from '../domain/period.util';

describe('period.util (Step 26 UTC month bounds)', () => {
  it('T01: month start is included in the period bound', () => {
    const p = utcMonthPeriod('2026-03');
    expect(p.periodStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(isTimestampInPeriod(p.periodStart, p)).toBe(true);
  });

  it('T02: last instant before next month is included', () => {
    const p = utcMonthPeriod('2026-03');
    const last = new Date('2026-03-31T23:59:59.999Z');
    expect(isTimestampInPeriod(last, p)).toBe(true);
  });

  it('T03: exact next-month boundary is excluded', () => {
    const p = utcMonthPeriod('2026-03');
    expect(p.periodEnd.toISOString()).toBe('2026-04-01T00:00:00.000Z');
    expect(isTimestampInPeriod(p.periodEnd, p)).toBe(false);
  });

  it('T04: leap-year February ends at March 1 UTC', () => {
    const p = utcMonthPeriod('2024-02');
    expect(p.periodStart.toISOString()).toBe('2024-02-01T00:00:00.000Z');
    expect(p.periodEnd.toISOString()).toBe('2024-03-01T00:00:00.000Z');
    expect(isTimestampInPeriod(new Date('2024-02-29T12:00:00.000Z'), p)).toBe(true);
  });

  it('T05: DST month still uses UTC calendar bounds (March 2026)', () => {
    const p = utcMonthPeriod('2026-03');
    expect(p.periodTimezone).toBe('UTC');
    expect(p.periodStart.toISOString()).toBe('2026-03-01T00:00:00.000Z');
    expect(p.periodEnd.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });

  it('T06: reporting timezone on period is always UTC', () => {
    expect(utcMonthPeriod('2026-07').periodTimezone).toBe('UTC');
  });

  it('T07: formatPeriodKeyUtc + assertPeriodKey round-trip', () => {
    const key = formatPeriodKeyUtc(new Date('2026-11-15T08:00:00.000Z'));
    expect(key).toBe('2026-11');
    expect(assertPeriodKey(key)).toEqual({ year: 2026, month: 11 });
    expect(() => assertPeriodKey('2026-13')).toThrow(/Invalid periodKey/);
    expect(() => assertPeriodKey('bad')).toThrow(/Invalid periodKey/);
  });
});
