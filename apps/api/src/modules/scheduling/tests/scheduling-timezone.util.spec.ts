import {
  applyWindowToZonedDay,
  dayOfWeekInTimezone,
  normalizeTimezone,
  zonedDayBoundsUtc,
} from '../domain/scheduling-timezone.util';

describe('scheduling-timezone.util', () => {
  it('normalizes invalid timezone to UTC', () => {
    expect(normalizeTimezone('Not/AZone')).toBe('UTC');
    expect(normalizeTimezone('Asia/Damascus')).toBe('Asia/Damascus');
  });

  it('computes day of week in timezone', () => {
    // 2026-06-15 is Monday in Damascus
    expect(dayOfWeekInTimezone('2026-06-15', 'Asia/Damascus')).toBe(1);
  });

  it('builds zoned day bounds as UTC instants', () => {
    const { start, end } = zonedDayBoundsUtc('2026-06-15', 'UTC');
    expect(start.toISOString()).toBe('2026-06-15T00:00:00.000Z');
    expect(end.getUTCHours()).toBe(23);
  });

  it('applies clinic hours window in timezone', () => {
    const range = applyWindowToZonedDay('2026-06-15', 'UTC', {
      startHour: 9,
      startMin: 0,
      endHour: 17,
      endMin: 0,
      isClosed: false,
    });
    expect(range).not.toBeNull();
    expect(range!.rangeStart.toISOString()).toBe('2026-06-15T09:00:00.000Z');
    expect(range!.rangeEnd.toISOString()).toBe('2026-06-15T17:00:00.000Z');
  });

  it('returns null when day is closed', () => {
    const range = applyWindowToZonedDay('2026-06-15', 'UTC', {
      startHour: 9,
      startMin: 0,
      endHour: 17,
      endMin: 0,
      isClosed: true,
    });
    expect(range).toBeNull();
  });
});
