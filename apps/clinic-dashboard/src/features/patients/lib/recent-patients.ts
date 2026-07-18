export interface RecentPatientEntry {
  id: string;
  firstName: string;
  lastName: string;
  firstNameAr: string | null;
  lastNameAr: string | null;
  visitedAt: string;
}

const STORAGE_KEY = 'booking.patients.recent';
const MAX_RECENT = 8;

export function getRecentPatients(): RecentPatientEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentPatientEntry[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

export function recordRecentPatient(entry: Omit<RecentPatientEntry, 'visitedAt'>): void {
  const next: RecentPatientEntry = { ...entry, visitedAt: new Date().toISOString() };
  const existing = getRecentPatients().filter((p) => p.id !== entry.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([next, ...existing].slice(0, MAX_RECENT)));
}
