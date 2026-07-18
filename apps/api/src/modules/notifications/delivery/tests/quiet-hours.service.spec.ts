import { QuietHoursService, isValidTimezone, resolveTimezone } from '../quiet-hours.service';

describe('QuietHoursService', () => {
  let service: QuietHoursService;

  beforeEach(() => {
    service = new QuietHoursService();
  });

  it('reports no quiet hours when unconfigured', () => {
    const decision = service.evaluate({ quietHoursStart: null, quietHoursEnd: null, tenantTimezone: 'UTC' });
    expect(decision.inQuietHours).toBe(false);
    expect(decision.deferUntil).toBeNull();
  });

  it('bypasses quiet hours entirely for a validated emergency override', () => {
    const decision = service.evaluate({
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      tenantTimezone: 'UTC',
      emergencyOverrideBypass: true,
      now: new Date('2024-01-15T23:00:00Z'),
    });
    expect(decision.inQuietHours).toBe(false);
    expect(decision.bypassed).toBe(true);
  });

  it('fails closed (defers) on an invalid timezone', () => {
    const decision = service.evaluate({
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      tenantTimezone: 'Not/ARealZone',
      now: new Date('2024-01-15T12:00:00Z'),
    });
    expect(decision.inQuietHours).toBe(true);
    expect(decision.deferUntil).not.toBeNull();
    expect(decision.timezoneUsed).toBeNull();
  });

  it('detects an overnight quiet-hours window using a fixed-offset timezone (Asia/Dubai, UTC+4)', () => {
    // 19:00 UTC = 23:00 Dubai local -> inside 22:00-06:00 window.
    const decision = service.evaluate({
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      recipientTimezone: 'Asia/Dubai',
      now: new Date('2024-01-15T19:00:00Z'),
    });
    expect(decision.inQuietHours).toBe(true);
    expect(decision.timezoneUsed).toBe('Asia/Dubai');
    // Window ends at 06:00 Dubai local next day = 02:00 UTC next day.
    expect(decision.deferUntil?.toISOString()).toBe('2024-01-16T02:00:00.000Z');
  });

  it('reports outside quiet hours for a daytime instant in the same timezone', () => {
    // 05:00 UTC = 09:00 Dubai local -> outside 22:00-06:00 window.
    const decision = service.evaluate({
      quietHoursStart: '22:00',
      quietHoursEnd: '06:00',
      recipientTimezone: 'Asia/Dubai',
      now: new Date('2024-01-15T05:00:00Z'),
    });
    expect(decision.inQuietHours).toBe(false);
    expect(decision.deferUntil).toBeNull();
  });

  it('prefers the most specific timezone: recipient over branch over tenant', () => {
    expect(
      resolveTimezone({ recipientTimezone: 'Asia/Dubai', branchTimezone: 'Europe/London', tenantTimezone: 'UTC' }),
    ).toBe('Asia/Dubai');
    expect(resolveTimezone({ branchTimezone: 'Europe/London', tenantTimezone: 'UTC' })).toBe('Europe/London');
    expect(resolveTimezone({ tenantTimezone: 'UTC' })).toBe('UTC');
    expect(resolveTimezone({})).toBe('UTC');
  });

  describe('isValidTimezone', () => {
    it('accepts a well-known IANA zone', () => {
      expect(isValidTimezone('Asia/Dubai')).toBe(true);
    });

    it('rejects a bogus zone name', () => {
      expect(isValidTimezone('Not/ARealZone')).toBe(false);
    });
  });
});
