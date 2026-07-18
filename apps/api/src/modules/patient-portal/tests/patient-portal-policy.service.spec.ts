import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';

describe('PatientPortalPolicy', () => {
  const policy = new PatientPortalPolicy();

  describe('canManageEnrollment', () => {
    it.each([['admin'], ['tenant_admin'], ['clinic_manager'], ['receptionist']])(
      'allows %s',
      (role) => {
        expect(policy.canManageEnrollment([role])).toBe(true);
      },
    );

    it.each([['patient'], ['physician'], ['nurse'], ['auditor']])('denies %s', (role) => {
      expect(policy.canManageEnrollment([role])).toBe(false);
    });
  });

  describe('canGovernAccounts', () => {
    it.each([['admin'], ['tenant_admin'], ['clinic_manager']])('allows %s', (role) => {
      expect(policy.canGovernAccounts([role])).toBe(true);
    });

    it('excludes receptionist from governance (security action)', () => {
      expect(policy.canGovernAccounts(['receptionist'])).toBe(false);
    });

    it('denies patients', () => {
      expect(policy.canGovernAccounts(['patient'])).toBe(false);
    });
  });

  describe('canViewAccounts', () => {
    it('allows enrollment staff', () => {
      expect(policy.canViewAccounts(['receptionist'])).toBe(true);
    });

    it('denies patients', () => {
      expect(policy.canViewAccounts(['patient'])).toBe(false);
    });
  });

  describe('isPatient', () => {
    it('detects the patient role', () => {
      expect(policy.isPatient(['patient'])).toBe(true);
      expect(policy.isPatient(['admin'])).toBe(false);
    });
  });

  it('is case-insensitive and null-safe', () => {
    expect(policy.canManageEnrollment(['ADMIN'])).toBe(true);
    expect(policy.canManageEnrollment(undefined as never)).toBe(false);
  });
});
