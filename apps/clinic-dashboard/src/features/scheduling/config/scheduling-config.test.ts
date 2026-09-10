import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_STATUS_OPTIONS,
  CALENDAR_VIEW_MODES,
  canCreateAppointment,
  canDeleteAppointment,
  canManageScheduling,
  canUpdateAppointment,
  formatTimeRange,
  formatTimezoneLabel,
  parseCalendarView,
  startOfWeek,
  toDateInputValue,
} from '../config/scheduling-config';

describe('scheduling-config', () => {
  it('gates create for scheduling permission', () => {
    const perm = (action: string) => action === 'create';
    expect(canCreateAppointment(perm)).toBe(true);
  });

  it('gates update for scheduling permission', () => {
    const perm = (action: string) => action === 'update';
    expect(canUpdateAppointment(perm)).toBe(true);
  });

  it('gates delete for scheduling permission', () => {
    const perm = (action: string) => action === 'delete';
    expect(canDeleteAppointment(perm)).toBe(true);
  });

  it('gates manage for schedule-admin actions (Wave G4)', () => {
    const manageOnly = (action: string) => action === 'manage';
    expect(canManageScheduling(manageOnly)).toBe(true);
    expect(canManageScheduling((a) => a === 'view')).toBe(false);
  });

  it('includes all backend statuses', () => {
    const values = APPOINTMENT_STATUS_OPTIONS.map((o) => o.value).filter(Boolean);
    expect(values).toContain('pending');
    expect(values).toContain('confirmed');
    expect(values).toContain('checked_in');
    expect(values).toContain('in_progress');
    expect(values).toContain('no_show');
  });

  it('formats time range in clinic timezone', () => {
    const start = '2026-06-15T09:00:00.000Z';
    const end = '2026-06-15T09:30:00.000Z';
    const zoned = formatTimeRange(start, end, 'en-US', 'UTC');
    expect(zoned).toMatch(/9:00/);
    expect(formatTimezoneLabel('UTC', 'en-US')).toContain('UTC');
  });

  it('formats time range', () => {
    const start = '2026-06-15T09:00:00.000Z';
    const end = '2026-06-15T09:30:00.000Z';
    expect(formatTimeRange(start, end, 'en-US')).toMatch(/–/);
  });

  it('computes week start on Monday', () => {
    const wed = new Date('2026-06-17T12:00:00');
    const mon = startOfWeek(wed);
    expect(mon.getDay()).toBe(1);
  });

  it('formats date input value', () => {
    expect(toDateInputValue(new Date('2026-06-15T15:00:00'))).toBe('2026-06-15');
  });

  it('parses calendar view modes', () => {
    expect(parseCalendarView('month')).toBe('month');
    expect(parseCalendarView('invalid')).toBe('day');
  });

  it('lists all calendar view modes', () => {
    expect(CALENDAR_VIEW_MODES).toContain('timeline');
    expect(CALENDAR_VIEW_MODES).toContain('resource');
  });
});
