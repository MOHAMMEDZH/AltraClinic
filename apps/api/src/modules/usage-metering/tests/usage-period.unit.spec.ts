import { UsagePeriodResolver } from '../application/usage-period.resolver';
import { LIFETIME_PERIOD_START } from '../usage-metering.constants';

describe('UsagePeriodResolver', () => {
  it('resolves LIFETIME to fixed epoch bounds', () => {
    const resolver = new UsagePeriodResolver(() => new Date('2026-07-15T12:00:00.000Z'));
    const p = resolver.resolve('LIFETIME');
    expect(p.periodType).toBe('LIFETIME');
    expect(p.periodStart.toISOString()).toBe(LIFETIME_PERIOD_START.toISOString());
    expect(p.periodEnd.getUTCFullYear()).toBe(9999);
  });

  it('resolves CALENDAR_MONTH as UTC [start, nextMonth)', () => {
    const resolver = new UsagePeriodResolver(() => new Date('2026-07-30T22:15:00.000Z'));
    const p = resolver.resolve('CALENDAR_MONTH');
    expect(p.periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(p.periodEnd.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(p.usageMonth).toBe('2026-07');
  });

  it('UTC month boundary: last ms of July stays in July; Aug 1 00:00 is August', () => {
    const endOfJuly = new UsagePeriodResolver(() => new Date('2026-07-31T23:59:59.999Z'));
    const july = endOfJuly.resolve('CALENDAR_MONTH');
    expect(july.periodStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(july.periodEnd.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(july.usageMonth).toBe('2026-07');

    const startOfAug = new UsagePeriodResolver(() => new Date('2026-08-01T00:00:00.000Z'));
    const aug = startOfAug.resolve('CALENDAR_MONTH');
    expect(aug.periodStart.toISOString()).toBe('2026-08-01T00:00:00.000Z');
    expect(aug.periodEnd.toISOString()).toBe('2026-09-01T00:00:00.000Z');
    expect(aug.usageMonth).toBe('2026-08');
  });

  it('rejects future skew beyond bound', () => {
    const resolver = new UsagePeriodResolver(() => new Date('2026-07-30T12:00:00.000Z'));
    expect(() => resolver.assertNotFutureSkew(new Date('2026-07-30T13:00:00.000Z'))).toThrow(/future/i);
  });
});
