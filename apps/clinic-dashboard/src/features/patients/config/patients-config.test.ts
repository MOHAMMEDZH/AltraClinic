import { describe, expect, it } from 'vitest';
import {
  canCreatePatient,
  canArchivePatient,
  DEFAULT_VISIBLE_COLUMNS,
  PATIENT_PAGE_SIZE,
  resolvePatientTabs,
} from '../config/patients-config';
import { patientFullName, formatPatientAge, genderLabelKey } from '../lib/patient-format';

describe('patients-config', () => {
  it('gates create for receptionist', () => {
    const perm = (action: string) => action === 'create';
    expect(canCreatePatient(perm)).toBe(true);
  });

  it('denies archive without delete permission', () => {
    const perm = () => false;
    expect(canArchivePatient(perm)).toBe(false);
  });

  it('has default visible columns', () => {
    expect(DEFAULT_VISIBLE_COLUMNS).toContain('name');
    expect(PATIENT_PAGE_SIZE).toBe(20);
  });
});

describe('patient-format', () => {
  it('formats full name in English', () => {
    expect(
      patientFullName(
        { firstName: 'Sarah', lastName: 'Hassan', firstNameAr: 'سارة', lastNameAr: 'حسن' },
        'en-US',
      ),
    ).toBe('Sarah Hassan');
  });

  it('formats full name in Arabic when available', () => {
    expect(
      patientFullName(
        { firstName: 'Sarah', lastName: 'Hassan', firstNameAr: 'سارة', lastNameAr: 'حسن' },
        'ar-SY',
      ),
    ).toBe('سارة حسن');
  });

  it('computes age from date of birth', () => {
    const dob = `${new Date().getFullYear() - 30}-01-15`;
    expect(formatPatientAge(dob, 'en-US')).toBe('30');
  });

  it('returns gender label keys', () => {
    expect(genderLabelKey('male')).toBe('patients.gender.male');
    expect(genderLabelKey(null)).toBe('patients.gender.unknown');
  });
});
