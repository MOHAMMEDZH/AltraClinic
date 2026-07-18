import type { PatientGender, PatientListItem } from '../types';

export function patientFullName(
  patient: Pick<PatientListItem, 'firstName' | 'lastName' | 'firstNameAr' | 'lastNameAr'>,
  locale: string,
): string {
  const useAr = locale.startsWith('ar') && patient.firstNameAr && patient.lastNameAr;
  if (useAr) return `${patient.firstNameAr} ${patient.lastNameAr}`;
  return `${patient.firstName} ${patient.lastName}`;
}

export function patientInitials(patient: Pick<PatientListItem, 'firstName' | 'lastName'>): string {
  return `${patient.firstName.charAt(0)}${patient.lastName.charAt(0)}`.toUpperCase();
}

export function formatPatientDate(
  value: string | null | undefined,
  locale: string,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  if (!value) return '—';
  try {
    return new Intl.DateTimeFormat(locale, options).format(new Date(value));
  } catch {
    return value;
  }
}

export function formatPatientAge(dateOfBirth: string | null, locale: string): string | null {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age -= 1;
  return new Intl.NumberFormat(locale).format(age);
}

export function genderLabelKey(gender: PatientGender | null): string {
  if (!gender) return 'patients.gender.unknown';
  return `patients.gender.${gender}`;
}

export function patientContactLine(patient: Pick<PatientListItem, 'phone' | 'email'>): string {
  return patient.phone ?? patient.email ?? '—';
}

export function buildPatientQrUrl(patientId: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(patientId)}`;
}
