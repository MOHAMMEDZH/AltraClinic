import { describe, expect, it } from 'vitest';
import { layoutDayGridAppointments, minutesFromDayStart } from './layout-day-events';
import type { AppointmentListItem } from '../types/scheduling.types';

function appt(id: string, start: Date, end: Date): AppointmentListItem {
  return {
    id,
    tenantId: 't1',
    patientId: 'p1',
    patientName: 'Patient',
    providerId: 'd1',
    branchId: null,
    start: start.toISOString(),
    end: end.toISOString(),
    status: 'confirmed',
    notes: null,
    serviceType: 'consultation',
    isEmergency: false,
    recurrenceSeriesId: null,
    resourceId: null,
    createdAt: start.toISOString(),
  };
}

describe('layoutDayGridAppointments', () => {
  const dayStart = new Date('2026-06-21T07:00:00');

  it('places non-overlapping appointments at full width', () => {
    const items = layoutDayGridAppointments(
      [
        appt('a', new Date('2026-06-21T09:00:00'), new Date('2026-06-21T09:30:00')),
        appt('b', new Date('2026-06-21T13:00:00'), new Date('2026-06-21T13:30:00')),
      ],
      dayStart,
    );

    expect(items).toHaveLength(2);
    expect(items.every((i) => i.columnCount === 1 && i.widthPct === 100)).toBe(true);
  });

  it('splits overlapping appointments into columns', () => {
    const items = layoutDayGridAppointments(
      [
        appt('a', new Date('2026-06-21T13:00:00'), new Date('2026-06-21T14:00:00')),
        appt('b', new Date('2026-06-21T13:45:00'), new Date('2026-06-21T14:15:00')),
      ],
      dayStart,
    );

    expect(items.find((i) => i.appt.id === 'a')?.column).toBe(0);
    expect(items.find((i) => i.appt.id === 'b')?.column).toBe(1);
    expect(items.every((i) => i.columnCount === 2 && i.widthPct === 50)).toBe(true);
  });

  it('expands into unused columns when no blocker exists', () => {
    const items = layoutDayGridAppointments(
      [
        appt('a', new Date('2026-06-21T11:00:00'), new Date('2026-06-21T11:30:00')),
        appt('b', new Date('2026-06-21T11:00:00'), new Date('2026-06-21T11:30:00')),
        appt('c', new Date('2026-06-21T12:00:00'), new Date('2026-06-21T12:30:00')),
      ],
      dayStart,
    );

    const morning = items.filter((i) => i.appt.id === 'a' || i.appt.id === 'b');
    expect(morning.every((i) => i.columnCount === 2 && i.widthPct === 50)).toBe(true);

    const afternoon = items.find((i) => i.appt.id === 'c');
    expect(afternoon?.columnCount).toBe(1);
    expect(afternoon?.widthPct).toBe(100);
  });

  it('positions events by start time', () => {
    const items = layoutDayGridAppointments(
      [appt('a', new Date('2026-06-21T13:45:00'), new Date('2026-06-21T14:15:00'))],
      dayStart,
    );

    const startMin = minutesFromDayStart(items[0].appt.start, dayStart);
    expect(startMin).toBe(6 * 60 + 45);
    expect(items[0].top).toBeGreaterThan(0);
  });
});
