import type { ListColumnId } from '../config/patients-config';
import type { PatientGender } from '../types';

export interface PatientSavedView {
  id: string;
  name: string;
  search: string;
  status: 'active' | 'archived' | 'all';
  gender: PatientGender | null;
  columns: ListColumnId[];
  createdAt: string;
}

const STORAGE_KEY = 'booking.patients.savedViews';
const MAX_VIEWS = 12;

function readAll(): PatientSavedView[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PatientSavedView[];
    return Array.isArray(parsed) ? parsed.slice(0, MAX_VIEWS) : [];
  } catch {
    return [];
  }
}

function writeAll(views: PatientSavedView[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(views.slice(0, MAX_VIEWS)));
}

export function listPatientSavedViews(): PatientSavedView[] {
  return readAll();
}

export function savePatientSavedView(
  view: Omit<PatientSavedView, 'id' | 'createdAt'> & { id?: string },
): PatientSavedView {
  const existing = readAll();
  const next: PatientSavedView = {
    id: view.id ?? crypto.randomUUID(),
    name: view.name.trim(),
    search: view.search.trim(),
    status: view.status,
    gender: view.gender,
    columns: view.columns,
    createdAt: view.id ? existing.find((v) => v.id === view.id)?.createdAt ?? new Date().toISOString() : new Date().toISOString(),
  };
  const without = existing.filter((v) => v.id !== next.id);
  writeAll([next, ...without]);
  return next;
}

export function deletePatientSavedView(id: string): void {
  writeAll(readAll().filter((v) => v.id !== id));
}
