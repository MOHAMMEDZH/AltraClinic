import {
  utcDaysUntil,
  matchesReminderDay,
  isExpiringWithinDays,
  isExpired,
  INVENTORY_EXPIRY_ALERT_DAYS,
} from '../domain/date.utils';

describe('date.utils', () => {
  const base = new Date('2026-06-15T12:00:00.000Z');

  it('computes UTC calendar days until end date', () => {
    expect(utcDaysUntil(new Date('2026-06-20T00:00:00.000Z'), base)).toBe(5);
    expect(utcDaysUntil(new Date('2026-06-15T23:59:59.000Z'), base)).toBe(0);
  });

  it('matches subscription reminder windows', () => {
    const end = new Date('2026-07-15T00:00:00.000Z');
    expect(matchesReminderDay(end, 30, base)).toBe(true);
    expect(matchesReminderDay(end, 29, base)).toBe(false);
  });

  it('detects inventory expiry windows', () => {
    const soon = new Date('2026-06-20T00:00:00.000Z');
    expect(isExpiringWithinDays(soon, INVENTORY_EXPIRY_ALERT_DAYS, base)).toBe(true);
    expect(isExpired(new Date('2026-06-10T00:00:00.000Z'), base)).toBe(true);
  });
});
