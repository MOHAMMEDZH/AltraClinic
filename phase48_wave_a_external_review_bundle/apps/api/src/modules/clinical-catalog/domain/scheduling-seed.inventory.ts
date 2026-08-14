import { SCHEDULING_SERVICE_TYPES } from '../../scheduling/domain/service-types';
import { schedulingIdToCanonicalStableKey } from './stable-key.helpers';

/** Seeded from scheduling keys — not a full clinical taxonomy. */
export const SCHEDULING_CANONICAL_SOURCE_SYSTEM = 'scheduling.service_type';

export interface SchedulingCanonicalSeedEntry {
  schedulingId: string;
  stableKey: string;
  defaultDurationMin: number;
  displayNameEn: string;
  displayNameAr: string;
}

const AR_LABELS: Record<string, string> = {
  consultation: 'استشارة',
  follow_up: 'متابعة',
  procedure: 'إجراء',
  cleaning: 'تنظيف',
  imaging: 'تصوير',
  lab: 'مختبر',
  emergency: 'طوارئ',
};

const EN_LABELS: Record<string, string> = {
  consultation: 'Consultation',
  follow_up: 'Follow Up',
  procedure: 'Procedure',
  cleaning: 'Cleaning',
  imaging: 'Imaging',
  lab: 'Lab',
  emergency: 'Emergency',
};

export const SCHEDULING_CANONICAL_SEED: SchedulingCanonicalSeedEntry[] =
  SCHEDULING_SERVICE_TYPES.map((entry) => ({
    schedulingId: entry.id,
    stableKey: schedulingIdToCanonicalStableKey(entry.id),
    defaultDurationMin: entry.defaultDurationMin,
    displayNameEn: EN_LABELS[entry.id] ?? entry.id,
    displayNameAr: AR_LABELS[entry.id] ?? entry.id,
  }));

export const KNOWN_SCHEDULING_IDS = new Set(
  SCHEDULING_SERVICE_TYPES.map((entry) => entry.id),
);

export function findSchedulingSeedById(schedulingId: string): SchedulingCanonicalSeedEntry | undefined {
  return SCHEDULING_CANONICAL_SEED.find((entry) => entry.schedulingId === schedulingId);
}
