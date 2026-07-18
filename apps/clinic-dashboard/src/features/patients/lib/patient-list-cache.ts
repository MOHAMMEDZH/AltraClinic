import type { PatientListItem } from '../types';

const CACHE_KEY = 'booking.patients.listCache';

export interface CachedPatientList {
  savedAt: string;
  items: PatientListItem[];
  total: number;
}

export function savePatientListCache(data: CachedPatientList): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export function loadPatientListCache(): CachedPatientList | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedPatientList;
  } catch {
    return null;
  }
}
