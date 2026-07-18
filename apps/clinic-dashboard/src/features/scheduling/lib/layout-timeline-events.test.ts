import { describe, expect, it } from 'vitest';
import {
  estimateTimelineLabelWidth,
  layoutTimelineRowEvents,
} from './layout-timeline-events';
import type { AppointmentListItem } from '../types/scheduling.types';

function appt(id: string, name: string, start: Date, end: Date): AppointmentListItem {
  return {
    id,
    tenantId: 't1',
    patientId: 'p1',
    patientName: name,
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

describe('layoutTimelineRowEvents', () => {
  const dayStart = new Date('2026-06-21T07:00:00');

  it('places non-overlapping appointments on the same lane', () => {
    const { items, laneCount } = layoutTimelineRowEvents(
      [
        appt('a', 'Sarah Hassan', new Date('2026-06-21T09:00:00'), new Date('2026-06-21T09:30:00')),
        appt('b', 'Omar Khalil', new Date('2026-06-21T11:00:00'), new Date('2026-06-21T11:30:00')),
      ],
      dayStart,
    );

    expect(laneCount).toBe(1);
    expect(items.every((i) => i.lane === 0)).toBe(true);
  });

  it('stacks overlapping appointments into separate lanes', () => {
    const { items, laneCount } = layoutTimelineRowEvents(
      [
        appt('a', 'Sarah Hassan', new Date('2026-06-21T09:00:00'), new Date('2026-06-21T09:45:00')),
        appt('b', 'Omar Khalil', new Date('2026-06-21T09:15:00'), new Date('2026-06-21T10:00:00')),
      ],
      dayStart,
    );

    expect(laneCount).toBe(2);
    expect(items.find((i) => i.appt.id === 'a')?.lane).toBe(0);
    expect(items.find((i) => i.appt.id === 'b')?.lane).toBe(1);
  });

  it('reserves enough width for the patient name', () => {
    const { items } = layoutTimelineRowEvents(
      [appt('a', 'Sarah Hassan', new Date('2026-06-21T09:00:00'), new Date('2026-06-21T09:15:00'))],
      dayStart,
    );

    expect(items[0].displayWidth).toBeGreaterThanOrEqual(estimateTimelineLabelWidth('Sarah Hassan'));
  });
});
