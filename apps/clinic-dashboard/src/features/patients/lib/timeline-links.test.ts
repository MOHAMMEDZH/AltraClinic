import { describe, expect, it } from 'vitest';
import { timelineEntryHref } from './timeline-links';

describe('timeline-links', () => {
  it('links appointments to scheduling', () => {
    expect(
      timelineEntryHref('p1', {
        id: 'a1',
        type: 'appointment',
        title: 'Visit',
        subtitle: null,
        occurredAt: '2026-01-01T10:00:00Z',
        status: 'confirmed',
      }),
    ).toBe('/appointments?view=list&selected=a1');
  });

  it('links encounters to EMR', () => {
    expect(
      timelineEntryHref('p1', {
        id: 'e1',
        type: 'encounter',
        title: 'Consultation',
        subtitle: null,
        occurredAt: '2026-01-01T10:00:00Z',
        status: null,
      }),
    ).toBe('/encounters/e1');
  });

  it('links treatment plans', () => {
    expect(
      timelineEntryHref('p1', {
        id: 'tp1',
        type: 'treatment',
        title: 'Crown prep',
        subtitle: 'D2740',
        occurredAt: '2026-01-01T00:00:00Z',
        status: 'COMPLETED',
        metadata: { planId: 'plan-1' },
      }),
    ).toBe('/dental/chart/p1/plan/plan-1');
  });
});
