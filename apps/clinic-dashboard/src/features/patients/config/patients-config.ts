import type { PatientTabId } from '../types';

export const PATIENT_PAGE_SIZE = 20;

export const PATIENT_TABS: PatientTabId[] = [
  'overview',
  'medical',
  'appointments',
  'billing',
  'documents',
  'notes',
  'activity',
];

export const LIST_COLUMNS = [
  { id: 'name', defaultVisible: true },
  { id: 'phone', defaultVisible: true },
  { id: 'email', defaultVisible: true },
  { id: 'dob', defaultVisible: true },
  { id: 'gender', defaultVisible: false },
  { id: 'nationalId', defaultVisible: false },
  { id: 'lastVisit', defaultVisible: true },
  { id: 'status', defaultVisible: true },
] as const;

export type ListColumnId = (typeof LIST_COLUMNS)[number]['id'];

export const DEFAULT_VISIBLE_COLUMNS: ListColumnId[] = LIST_COLUMNS.filter(
  (c) => c.defaultVisible,
).map((c) => c.id);

export function canCreatePatient(perm: (action: string) => boolean): boolean {
  return perm('create');
}

export function canUpdatePatient(perm: (action: string) => boolean): boolean {
  return perm('update');
}

export function canArchivePatient(perm: (action: string) => boolean): boolean {
  return perm('delete');
}

export function canMergePatients(perm: (action: string) => boolean): boolean {
  return perm('manage');
}

export function canExportPatients(perm: (action: string) => boolean): boolean {
  return perm('export');
}

export interface PatientTabPermissions {
  billing: boolean;
  medical: boolean;
  documents: boolean;
}

export function resolvePatientTabs(permissions: PatientTabPermissions): PatientTabId[] {
  return PATIENT_TABS.filter((tab) => {
    if (tab === 'billing') return permissions.billing;
    if (tab === 'medical') return permissions.medical;
    if (tab === 'documents') return permissions.documents;
    return true;
  });
}
