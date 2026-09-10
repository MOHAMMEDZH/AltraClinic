/**
 * Shared slot generation with Wave G exception precedence.
 */
import {
  type AvailabilityExceptionInterval,
  type UtcRange,
  resolveOpenRanges,
  slotDeniedForProvider,
  slotDeniedForResource,
} from '../../domain/availability-exception-evaluator';

const SLOT_INTERVAL_MIN = 15;

export function generateSlotsInRanges(
  ranges: UtcRange[],
  durationMin: number,
  intervalMin: number = SLOT_INTERVAL_MIN,
): UtcRange[] {
  const slots: UtcRange[] = [];
  for (const range of ranges) {
    const cursor = new Date(range.start);
    while (cursor.getTime() + durationMin * 60_000 <= range.end.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + durationMin * 60_000);
      slots.push({ start: slotStart, end: slotEnd });
      cursor.setMinutes(cursor.getMinutes() + intervalMin);
    }
  }
  return slots;
}

export function buildProviderAvailabilitySlots(input: {
  weekly: UtcRange | null;
  exceptions: AvailabilityExceptionInterval[];
  providerId: string;
  branchId: string | null;
  durationMin: number;
  busy: UtcRange[];
}): Array<{ start: string; end: string }> {
  const open = resolveOpenRanges(input.weekly, input.exceptions, {
    providerId: input.providerId,
    branchId: input.branchId,
  });
  const candidates = generateSlotsInRanges(open, input.durationMin);
  const out: Array<{ start: string; end: string }> = [];
  for (const slot of candidates) {
    if (slotDeniedForProvider(slot, input.exceptions, input.providerId, input.branchId)) {
      continue;
    }
    const overlapsBusy = input.busy.some((b) =>
      slot.start.getTime() < b.end.getTime() && slot.end.getTime() > b.start.getTime(),
    );
    if (overlapsBusy) continue;
    out.push({ start: slot.start.toISOString(), end: slot.end.toISOString() });
  }
  return out;
}

export function buildResourceAvailabilitySlots(input: {
  weekly: UtcRange | null;
  exceptions: AvailabilityExceptionInterval[];
  resourceId: string;
  branchId: string | null;
  durationMin: number;
  busy: UtcRange[];
}): Array<{ start: string; end: string }> {
  const open = resolveOpenRanges(input.weekly, input.exceptions, {
    resourceId: input.resourceId,
    branchId: input.branchId,
  });
  const candidates = generateSlotsInRanges(open, input.durationMin);
  const out: Array<{ start: string; end: string }> = [];
  for (const slot of candidates) {
    if (slotDeniedForResource(slot, input.exceptions, input.resourceId, input.branchId)) {
      continue;
    }
    const overlapsBusy = input.busy.some((b) =>
      slot.start.getTime() < b.end.getTime() && slot.end.getTime() > b.start.getTime(),
    );
    if (overlapsBusy) continue;
    out.push({ start: slot.start.toISOString(), end: slot.end.toISOString() });
  }
  return out;
}
