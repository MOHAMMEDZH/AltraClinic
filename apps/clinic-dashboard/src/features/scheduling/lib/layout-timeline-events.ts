import type { AppointmentListItem } from '../types/scheduling.types';
import { snapDayGridMinutes } from './layout-day-events';

export const TIMELINE_PX_PER_HOUR = 96;
export const TIMELINE_LANE_HEIGHT = 38;
export const TIMELINE_LANE_GAP = 6;
export const TIMELINE_MIN_DURATION_WIDTH = 12;

export interface TimelineLayoutItem {
  appt: AppointmentListItem;
  startMin: number;
  endMin: number;
  durationMin: number;
  left: number;
  /** Width matching the scheduled duration on the axis. */
  durationWidth: number;
  /** Width reserved on the axis so the patient name fits. */
  displayWidth: number;
  lane: number;
}

function minutesFromDayStart(iso: string, dayStart: Date): number {
  return (new Date(iso).getTime() - dayStart.getTime()) / 60_000;
}

/** Rough px width for a single-line patient name inside the bar. */
export function estimateTimelineLabelWidth(name: string): number {
  return Math.min(260, Math.max(96, Math.ceil(name.length * 7.5) + 20));
}

/** Stack appointments into lanes when labels or bars would collide visually. */
export function layoutTimelineRowEvents(
  appointments: AppointmentListItem[],
  dayStart: Date,
  pxPerHour = TIMELINE_PX_PER_HOUR,
): { items: TimelineLayoutItem[]; laneCount: number } {
  const items = appointments
    .map((appt) => {
      const startMin = minutesFromDayStart(appt.start, dayStart);
      const endMin = minutesFromDayStart(appt.end, dayStart);
      const durationMin = Math.max(endMin - startMin, 15);
      const left = (startMin / 60) * pxPerHour;
      const durationWidth = Math.max(
        (durationMin / 60) * pxPerHour - 2,
        TIMELINE_MIN_DURATION_WIDTH,
      );
      const displayWidth = Math.max(durationWidth, estimateTimelineLabelWidth(appt.patientName));
      return { appt, startMin, endMin, durationMin, left, durationWidth, displayWidth, lane: 0 };
    })
    .sort((a, b) => a.startMin - b.startMin || b.durationMin - a.durationMin);

  const laneRights: number[] = [];

  for (const item of items) {
    let lane = laneRights.findIndex((right) => right <= item.left + 0.5);
    if (lane === -1) {
      lane = laneRights.length;
      laneRights.push(item.left + item.displayWidth);
    } else {
      laneRights[lane] = Math.max(laneRights[lane], item.left + item.displayWidth);
    }
    item.lane = lane;
  }

  return { items, laneCount: Math.max(laneRights.length, 1) };
}

export function snapTimelineMinutes(leftPx: number, pxPerHour = TIMELINE_PX_PER_HOUR): number {
  const raw = (leftPx / pxPerHour) * 60;
  return snapDayGridMinutes(raw);
}

export { snapDayGridMinutes };
