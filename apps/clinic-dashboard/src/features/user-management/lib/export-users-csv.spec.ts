import { describe, expect, it } from 'vitest';
import type { UserSummary } from '../api/identity-api';
import { buildUsersCsv } from './export-users-csv';

const sampleUser: UserSummary = {
  id: '1',
  email: 'a@clinic.com',
  firstName: 'Ada',
  lastName: 'Lovelace',
  firstNameAr: null,
  lastNameAr: null,
  fullName: 'Ada "Test" Lovelace',
  phone: null,
  jobTitle: null,
  departmentId: null,
  employmentStatus: 'active',
  roles: ['doctor'],
  tenantId: 't1',
  branchId: null,
  isActive: true,
  emailVerified: true,
  mfaEnabled: false,
  isLocked: false,
  lockedUntil: null,
  lastLoginAt: '2026-01-01T00:00:00.000Z',
  lastLoginIp: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('export-users-csv', () => {
  it('builds CSV with BOM, header, and escaped names', () => {
    const csv = buildUsersCsv([sampleUser]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('Name,Email,Roles,Status,MFA,Last login,Branch');
    expect(csv).toContain('"Ada ""Test"" Lovelace"');
    expect(csv).toContain('doctor');
    expect(csv).toContain('active');
  });
});
