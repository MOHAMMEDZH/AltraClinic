import { describe, expect, it } from 'vitest';
import { buildPatientWordDocument } from './export-patient-word';
import type { PatientDetail } from '../types';

const samplePatient: PatientDetail = {
  id: 'p1',
  tenantId: 't1',
  branchId: null,
  firstName: 'Sarah',
  lastName: 'Hassan',
  firstNameAr: 'سارة',
  lastNameAr: 'حسن',
  phone: '+963 944 123 456',
  email: 'sarah@example.com',
  dateOfBirth: '1990-04-12',
  gender: 'female',
  nationalId: 'NID-001',
  bloodGroup: 'O+',
  notes: 'Follow up soon.',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
  archived: false,
  lastVisitAt: null,
  profileData: {
    allergies: ['Penicillin'],
    chronicConditions: ['Asthma'],
    communication: { whatsapp: true, email: true },
    consent: { treatmentConsent: true },
  },
  addresses: [{ id: 'a1', line1: 'Main St', line2: null, city: 'Damascus', state: null, postalCode: null, country: 'SY', isPrimary: true }],
};

const t = (key: string) => key;

describe('export-patient-word', () => {
  it('builds document sections from patient detail', () => {
    const doc = buildPatientWordDocument(samplePatient, 'en-US', t);
    expect(doc.title).toBe('patients.summaryExport.title');
    expect(doc.sections.length).toBeGreaterThan(4);
    expect(doc.notes).toBe('Follow up soon.');
  });
});
