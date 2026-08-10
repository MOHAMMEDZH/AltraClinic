import { ForbiddenException } from '@nestjs/common';
import { permissionsForRoles, assertNoWildcards } from '../platform-rbac/platform-rbac.catalog';
import { PlatformSodService } from '../platform-rbac/platform-sod.service';

describe('platform RBAC catalog', () => {
  it('has no wildcard grants and keeps auditors read-only', () => {
    assertNoWildcards();
    expect(permissionsForRoles(['auditor'])).not.toContain('platform-user.invite');
    expect(permissionsForRoles(['sales_representative'])).not.toContain('platform-user.invite');
  });

  it('does not grant unknown or super-admin role names', () => {
    expect(permissionsForRoles(['super_admin'])).toEqual([]);
  });

  it('prevents self-elevation and last-owner removal', async () => {
    const sod = new PlatformSodService({
      countActiveOwners: jest.fn().mockResolvedValue(1),
      countActiveSecurityAdmins: jest.fn().mockResolvedValue(2),
      resolveActiveRoleKeys: jest.fn().mockResolvedValue(['platform_owner']),
    } as any);
    expect(() => sod.assertNotSelf('u1', 'u1', 'assign roles')).toThrow(ForbiddenException);
    await expect(sod.assertCanRemoveRole('u1', 'platform_owner')).rejects.toThrow(ForbiddenException);
    await expect(sod.assertCanSuspend('u2', 'u1')).rejects.toThrow(ForbiddenException);
  });

  it('requires three distinct MFA reset parties', () => {
    const sod = new PlatformSodService({} as any);
    expect(() => sod.assertMfaResetApprover('requester', 'requester', 'target')).toThrow(ForbiddenException);
    expect(() => sod.assertMfaResetApprover('requester', 'approver', 'target')).not.toThrow();
  });
});
