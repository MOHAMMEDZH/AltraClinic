import { describe, expect, it } from 'vitest';
import type { AppointmentListItem } from '../types/scheduling.types';
import { isSameCalendarDay, rescheduleAppointmentToDay } from './scheduling-drag.util';

const appt = {
  id: 'a1',
  start: '2026-06-21T10:30:00.000Z',
  end: '2026-06-21T11:00:00.000Z',
} as AppointmentListItem;

describe('rescheduleAppointmentToDay', () => {
  it('moves appointment to target day preserving local time and duration', () => {
    const target = new Date(2026, 5, 23);
    const { start, end } = rescheduleAppointmentToDay(appt, target);
    const startDate = new Date(start);
    const endDate = new Date(end);

    expect(startDate.getFullYear()).toBe(2026);
    expect(startDate.getMonth()).toBe(5);
    expect(startDate.getDate()).toBe(23);
    expect(startDate.getHours()).toBe(new Date(appt.start).getHours());
    expect(startDate.getMinutes()).toBe(new Date(appt.start).getMinutes());
    expect(endDate.getTime() - startDate.getTime()).toBe(30 * 60_000);
  });
});

describe('isSameCalendarDay', () => {
  it('returns true for same calendar day', () => {
    expect(isSameCalendarDay(new Date(2026, 5, 21, 9), new Date(2026, 5, 21, 17))).toBe(true);
  });
});
