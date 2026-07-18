import type { PatientTimelineEntry } from '../types';

export type TimelineFilterId = 'all' | PatientTimelineEntry['type'];

export const TIMELINE_FILTER_IDS: TimelineFilterId[] = [
  'all',
  'appointment',
  'encounter',
  'invoice',
  'imaging',
  'document',
  'note',
  'diagnosis',
  'prescription',
  'treatment',
  'audit',
  'perio',
];

export function filterTimelineItems(
  items: PatientTimelineEntry[],
  filter: TimelineFilterId,
): PatientTimelineEntry[] {
  if (filter === 'all') return items;
  return items.filter((item) => item.type === filter);
}
