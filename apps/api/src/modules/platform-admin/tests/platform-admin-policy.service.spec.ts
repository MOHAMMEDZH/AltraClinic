import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';

describe('PlatformAdminPolicy', () => {
  const policy = new PlatformAdminPolicy();

  it('grants every capability to a System Administrator', () => {
    const roles = ['system_administrator'];
    expect(policy.canManageTenantLifecycle(roles)).toBe(true);
    expect(policy.canArchiveTenant(roles)).toBe(true);
    expect(policy.canRequestPrivilegedAccess(roles)).toBe(true);
    expect(policy.canReviewPrivilegedAccess(roles)).toBe(true);
    expect(policy.canViewPlatform(roles)).toBe(true);
  });

  it('accepts the super_admin alias and is case-insensitive', () => {
    expect(policy.canViewPlatform(['Super_Admin'])).toBe(true);
  });

  it('denies tenant-scoped roles', () => {
    for (const role of ['tenant_admin', 'clinic_manager', 'physician', 'receptionist', 'patient', 'auditor']) {
      expect(policy.canManageTenantLifecycle([role])).toBe(false);
      expect(policy.canViewPlatform([role])).toBe(false);
      expect(policy.canReviewPrivilegedAccess([role])).toBe(false);
    }
  });

  it('denies when no roles are present', () => {
    expect(policy.canViewPlatform([])).toBe(false);
  });
});
