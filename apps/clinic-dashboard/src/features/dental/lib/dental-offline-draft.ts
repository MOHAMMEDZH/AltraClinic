import type { ToothRecord } from '../types/dental.types';

const DRAFT_PREFIX = 'booking.dental.draft.';

export interface DentalChartDraft {
  patientId: string;
  teeth: ToothRecord[];
  odontogramMode?: 'adult' | 'pediatric';
  savedAt: string;
}

export function saveDentalDraft(draft: DentalChartDraft): void {
  try {
    localStorage.setItem(DRAFT_PREFIX + draft.patientId, JSON.stringify(draft));
  } catch {
    /* storage unavailable */
  }
}

export function loadDentalDraft(patientId: string): DentalChartDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_PREFIX + patientId);
    if (!raw) return null;
    return JSON.parse(raw) as DentalChartDraft;
  } catch {
    return null;
  }
}

export function clearDentalDraft(patientId: string): void {
  localStorage.removeItem(DRAFT_PREFIX + patientId);
}

export function hasDentalDraft(patientId: string): boolean {
  return localStorage.getItem(DRAFT_PREFIX + patientId) != null;
}
