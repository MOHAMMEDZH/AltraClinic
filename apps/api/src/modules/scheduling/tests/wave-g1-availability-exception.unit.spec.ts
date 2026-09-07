/**
 * Wave G1 / P1-11 — AvailabilityException precedence (unit).
 */
import {
  buildProviderAvailabilitySlots,
  buildResourceAvailabilitySlots,
} from '../application/services/availability-slot-builder';
import {
  resolveOpenRanges,
  slotDeniedForProvider,
  type AvailabilityExceptionInterval,
} from '../domain/availability-exception-evaluator';

function utc(iso: string): Date {
  return new Date(iso);
}

describe('Wave G1 AvailabilityException precedence (unit)', () => {
  const weekly = {
    start: utc('2026-09-07T08:00:00.000Z'),
    end: utc('2026-09-07T12:00:00.000Z'),
  };
  const providerId = 'prov-1';
  const branchId = 'branch-1';

  it('G1-DENY-01 — PROVIDER_LEAVE beats weekly open for overlapping slots', () => {
    const exceptions: AvailabilityExceptionInterval[] = [
      {
        type: 'PROVIDER_LEAVE',
        startsAt: utc('2026-09-07T09:00:00.000Z'),
        endsAt: utc('2026-09-07T10:00:00.000Z'),
        providerId,
        branchId,
      },
    ];
    const slots = buildProviderAvailabilitySlots({
      weekly,
      exceptions,
      providerId,
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(slots.some((s) => s.start === '2026-09-07T09:00:00.000Z')).toBe(false);
    expect(slots.some((s) => s.start === '2026-09-07T08:00:00.000Z')).toBe(true);
    expect(slots.some((s) => s.start === '2026-09-07T10:00:00.000Z')).toBe(true);
  });

  it('G1-DENY-02 — BRANCH_HOLIDAY denies provider and resource slots', () => {
    const exceptions: AvailabilityExceptionInterval[] = [
      {
        type: 'BRANCH_HOLIDAY',
        startsAt: utc('2026-09-07T08:00:00.000Z'),
        endsAt: utc('2026-09-07T12:00:00.000Z'),
        branchId,
      },
    ];
    expect(
      slotDeniedForProvider(
        { start: utc('2026-09-07T08:30:00.000Z'), end: utc('2026-09-07T09:00:00.000Z') },
        exceptions,
        providerId,
        branchId,
      ),
    ).toBe(true);

    const providerSlots = buildProviderAvailabilitySlots({
      weekly,
      exceptions,
      providerId,
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(providerSlots).toEqual([]);

    const resourceSlots = buildResourceAvailabilitySlots({
      weekly,
      exceptions,
      resourceId: 'room-1',
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(resourceSlots).toEqual([]);
  });

  it('G1-EXTRA-01 — EXTRA_AVAILABILITY adds slots when weekly closed', () => {
    const exceptions: AvailabilityExceptionInterval[] = [
      {
        type: 'EXTRA_AVAILABILITY',
        startsAt: utc('2026-09-07T14:00:00.000Z'),
        endsAt: utc('2026-09-07T15:00:00.000Z'),
        providerId,
        branchId,
      },
    ];
    const open = resolveOpenRanges(null, exceptions, { providerId, branchId });
    expect(open).toHaveLength(1);
    expect(open[0].start.toISOString()).toBe('2026-09-07T14:00:00.000Z');

    const slots = buildProviderAvailabilitySlots({
      weekly: null,
      exceptions,
      providerId,
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(slots.map((s) => s.start)).toEqual([
      '2026-09-07T14:00:00.000Z',
      '2026-09-07T14:15:00.000Z',
      '2026-09-07T14:30:00.000Z',
    ]);
  });

  it('G1-EXTRA-02 — deny still beats EXTRA for overlapping interval', () => {
    const exceptions: AvailabilityExceptionInterval[] = [
      {
        type: 'EXTRA_AVAILABILITY',
        startsAt: utc('2026-09-07T14:00:00.000Z'),
        endsAt: utc('2026-09-07T16:00:00.000Z'),
        providerId,
        branchId,
      },
      {
        type: 'PROVIDER_LEAVE',
        startsAt: utc('2026-09-07T14:30:00.000Z'),
        endsAt: utc('2026-09-07T15:00:00.000Z'),
        providerId,
        branchId,
      },
    ];
    const slots = buildProviderAvailabilitySlots({
      weekly: null,
      exceptions,
      providerId,
      branchId,
      durationMin: 30,
      busy: [],
    });
    expect(slots.some((s) => s.start === '2026-09-07T14:30:00.000Z')).toBe(false);
    expect(slots.some((s) => s.start === '2026-09-07T14:00:00.000Z')).toBe(true);
    expect(slots.some((s) => s.start === '2026-09-07T15:00:00.000Z')).toBe(true);
  });

  it('G1-RES-01 — RESOURCE_MAINTENANCE denies only matching resource', () => {
    const exceptions: AvailabilityExceptionInterval[] = [
      {
        type: 'RESOURCE_MAINTENANCE',
        startsAt: utc('2026-09-07T08:00:00.000Z'),
        endsAt: utc('2026-09-07T12:00:00.000Z'),
        resourceId: 'room-1',
        branchId,
      },
    ];
    expect(
      buildResourceAvailabilitySlots({
        weekly,
        exceptions,
        resourceId: 'room-1',
        branchId,
        durationMin: 30,
        busy: [],
      }),
    ).toEqual([]);
    expect(
      buildResourceAvailabilitySlots({
        weekly,
        exceptions,
        resourceId: 'room-2',
        branchId,
        durationMin: 30,
        busy: [],
      }).length,
    ).toBeGreaterThan(0);
    expect(
      buildProviderAvailabilitySlots({
        weekly,
        exceptions,
        providerId,
        branchId,
        durationMin: 30,
        busy: [],
      }).length,
    ).toBeGreaterThan(0);
  });
});
