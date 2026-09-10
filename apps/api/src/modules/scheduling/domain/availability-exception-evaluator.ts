/**
 * Wave G / P1-11 — pure availability-exception precedence helpers.
 * Deny exceptions beat weekly open; EXTRA_AVAILABILITY adds ranges.
 */

export type AvailabilityExceptionKind =
  | 'PROVIDER_LEAVE'
  | 'BRANCH_HOLIDAY'
  | 'RESOURCE_MAINTENANCE'
  | 'EXTRA_AVAILABILITY';

export interface UtcRange {
  start: Date;
  end: Date;
}

export interface AvailabilityExceptionInterval {
  type: AvailabilityExceptionKind;
  startsAt: Date;
  endsAt: Date;
  branchId?: string | null;
  providerId?: string | null;
  resourceId?: string | null;
}

export function rangesOverlap(a: UtcRange, b: UtcRange): boolean {
  return a.start.getTime() < b.end.getTime() && a.end.getTime() > b.start.getTime();
}

export function isDenyExceptionType(type: AvailabilityExceptionKind): boolean {
  return type !== 'EXTRA_AVAILABILITY';
}

export function denyAppliesToProvider(
  ex: AvailabilityExceptionInterval,
  providerId: string,
  branchId: string | null,
): boolean {
  if (!isDenyExceptionType(ex.type)) return false;
  if (ex.type === 'RESOURCE_MAINTENANCE') return false;
  if (ex.type === 'BRANCH_HOLIDAY') {
    if (ex.branchId && branchId && ex.branchId !== branchId) return false;
    return true;
  }
  if (ex.type === 'PROVIDER_LEAVE') {
    if (ex.providerId && ex.providerId !== providerId) return false;
    return true;
  }
  return false;
}

export function denyAppliesToResource(
  ex: AvailabilityExceptionInterval,
  resourceId: string,
  branchId: string | null,
): boolean {
  if (!isDenyExceptionType(ex.type)) return false;
  if (ex.type === 'PROVIDER_LEAVE') return false;
  if (ex.type === 'BRANCH_HOLIDAY') {
    if (ex.branchId && branchId && ex.branchId !== branchId) return false;
    return true;
  }
  if (ex.type === 'RESOURCE_MAINTENANCE') {
    if (ex.resourceId && ex.resourceId !== resourceId) return false;
    return true;
  }
  return false;
}

export function extraApplies(
  ex: AvailabilityExceptionInterval,
  opts: { providerId?: string | null; resourceId?: string | null; branchId: string | null },
): boolean {
  if (ex.type !== 'EXTRA_AVAILABILITY') return false;
  if (ex.branchId && opts.branchId && ex.branchId !== opts.branchId) return false;
  if (ex.providerId && opts.providerId && ex.providerId !== opts.providerId) return false;
  if (ex.resourceId && opts.resourceId && ex.resourceId !== opts.resourceId) return false;
  return true;
}

/** Merge overlapping/adjacent UTC ranges into a sorted minimal cover. */
export function mergeUtcRanges(ranges: UtcRange[]): UtcRange[] {
  const sorted = ranges
    .filter((r) => r.end.getTime() > r.start.getTime())
    .sort((a, b) => a.start.getTime() - b.start.getTime());
  if (sorted.length === 0) return [];

  const out: UtcRange[] = [{ start: sorted[0].start, end: sorted[0].end }];
  for (let i = 1; i < sorted.length; i++) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start.getTime() <= last.end.getTime()) {
      if (cur.end.getTime() > last.end.getTime()) last.end = cur.end;
    } else {
      out.push({ start: cur.start, end: cur.end });
    }
  }
  return out;
}

/**
 * Weekly open range (null if closed) union EXTRA ranges → bookable windows
 * before deny filtering.
 */
export function resolveOpenRanges(
  weekly: UtcRange | null,
  extras: AvailabilityExceptionInterval[],
  opts: { providerId?: string | null; resourceId?: string | null; branchId: string | null },
): UtcRange[] {
  const seed: UtcRange[] = [];
  if (weekly) seed.push(weekly);
  for (const ex of extras) {
    if (!extraApplies(ex, opts)) continue;
    seed.push({ start: ex.startsAt, end: ex.endsAt });
  }
  return mergeUtcRanges(seed);
}

export function slotDeniedForProvider(
  slot: UtcRange,
  exceptions: AvailabilityExceptionInterval[],
  providerId: string,
  branchId: string | null,
): boolean {
  return exceptions.some(
    (ex) =>
      denyAppliesToProvider(ex, providerId, branchId) &&
      rangesOverlap(slot, { start: ex.startsAt, end: ex.endsAt }),
  );
}

export function slotDeniedForResource(
  slot: UtcRange,
  exceptions: AvailabilityExceptionInterval[],
  resourceId: string,
  branchId: string | null,
): boolean {
  return exceptions.some(
    (ex) =>
      denyAppliesToResource(ex, resourceId, branchId) &&
      rangesOverlap(slot, { start: ex.startsAt, end: ex.endsAt }),
  );
}
