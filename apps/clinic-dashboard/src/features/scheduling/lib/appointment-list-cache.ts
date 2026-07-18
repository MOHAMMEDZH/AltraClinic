import type { AppointmentListItem } from '../types/scheduling.types';

const CACHE_KEY = 'booking.scheduling.listCache';

export interface CachedAppointmentList {
  savedAt: string;
  items: AppointmentListItem[];
  total: number;
}

export function saveAppointmentListCache(data: CachedAppointmentList): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
  } catch {
    /* ignore quota errors */
  }
}

export function loadAppointmentListCache(): CachedAppointmentList | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CachedAppointmentList;
  } catch {
    return null;
  }
}
