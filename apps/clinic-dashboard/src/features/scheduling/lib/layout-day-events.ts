import type { AppointmentListItem } from '../types/scheduling.types';

export const DAY_GRID_HOUR_HEIGHT = 64;
export const DAY_GRID_MIN_EVENT_HEIGHT = 22;
export const DAY_GRID_EVENT_GAP = 3;

export interface DayGridLayoutItem {
  appt: AppointmentListItem;
  startMin: number;
  endMin: number;
  durationMin: number;
  top: number;
  height: number;
  column: number;
  columnCount: number;
  columnSpan: number;
  leftPct: number;
  widthPct: number;
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function minutesFromDayStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

function buildOverlapClusters(items: Array<{ startMin: number; endMin: number }>): number[][] {
  const clusters: number[][] = [];
  const assigned = new Set<number>();

  for (let i = 0; i < items.length; i++) {
    if (assigned.has(i)) continue;

    const cluster = [i];
    assigned.add(i);
    let changed = true;

    while (changed) {
      changed = false;
      for (let j = 0; j < items.length; j++) {
        if (assigned.has(j)) continue;
        const overlapsCluster = cluster.some((idx) =>
          rangesOverlap(items[idx].startMin, items[idx].endMin, items[j].startMin, items[j].endMin),
        );
        if (overlapsCluster) {
          cluster.push(j);
          assigned.add(j);
          changed = true;
        }
      }
    }

    clusters.push(cluster);
  }

  return clusters;
}

function computeColumnSpan(
  item: { startMin: number; endMin: number; column: number },
  clusterItems: Array<{ startMin: number; endMin: number; column: number }>,
  columnCount: number,
): number {
  let span = 1;
  for (let col = item.column + 1; col < columnCount; col++) {
    const blocked = clusterItems.some(
      (other) =>
        other.column === col &&
        rangesOverlap(item.startMin, item.endMin, other.startMin, other.endMin),
    );
    if (blocked) break;
    span++;
  }
  return span;
}

/** Assign side-by-side columns for overlapping appointments (Google Calendar style). */
export function layoutDayGridAppointments(
  appointments: AppointmentListItem[],
  dayStart: Date,
  hourHeight = DAY_GRID_HOUR_HEIGHT,
): DayGridLayoutItem[] {
  const items = appointments
    .map((appt) => {
      const startMin = minutesFromDayStart(appt.start, dayStart);
      const endMin = minutesFromDayStart(appt.end, dayStart);
      const durationMin = Math.max(endMin - startMin, 15);
      const top = (startMin / 60) * hourHeight + DAY_GRID_EVENT_GAP / 2;
      const height = Math.max(
        (durationMin / 60) * hourHeight - DAY_GRID_EVENT_GAP,
        DAY_GRID_MIN_EVENT_HEIGHT,
      );
      return { appt, startMin, endMin, durationMin, top, height, column: 0 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin);

  const clusters = buildOverlapClusters(items);

  for (const clusterIndices of clusters) {
    const clusterItems = clusterIndices.map((i) => items[i]);
    const columnEnds: number[] = [];

    for (const item of clusterItems) {
      let column = columnEnds.findIndex((end) => end <= item.startMin);
      if (column === -1) {
        column = columnEnds.length;
        columnEnds.push(item.endMin);
      } else {
        columnEnds[column] = item.endMin;
      }
      item.column = column;
    }

    const columnCount = columnEnds.length;

    for (const item of clusterItems) {
      const columnSpan = computeColumnSpan(item, clusterItems, columnCount);
      const widthPct = (columnSpan / columnCount) * 100;
      const leftPct = (item.column / columnCount) * 100;

      Object.assign(item, { columnCount, columnSpan, leftPct, widthPct });
    }
  }

  for (const item of items) {
    if (!('columnCount' in item) || item.columnCount === undefined) {
      Object.assign(item, {
        columnCount: 1,
        columnSpan: 1,
        leftPct: 0,
        widthPct: 100,
      });
    }
  }

  return items as DayGridLayoutItem[];
}

export function snapDayGridMinutes(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}
