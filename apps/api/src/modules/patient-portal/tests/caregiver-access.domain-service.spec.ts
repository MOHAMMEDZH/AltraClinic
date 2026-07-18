import { CaregiverAccessDomainService } from '../domain/services/caregiver-access.domain-service';
import { PortalAccount } from '../domain/entities/portal-account.entity';

describe('CaregiverAccessDomainService', () => {
  const service = new CaregiverAccessDomainService();

  function activeAccountWithGrant() {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      invitedBy: 'staff-1',
    });
    account.activate('user-9');
    account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments', 'billing'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    return account;
  }

  it('allows a granted scope for a matching caregiver', () => {
    const account = activeAccountWithGrant();
    expect(service.decide(account, 'mum@example.com', 'appointments')).toEqual({
      allowed: true,
      reason: 'granted',
    });
  });

  it('matches the caregiver contact case-insensitively', () => {
    const account = activeAccountWithGrant();
    expect(service.decide(account, 'MUM@EXAMPLE.COM', 'billing').allowed).toBe(true);
  });

  it('denies a scope that was not granted', () => {
    const account = activeAccountWithGrant();
    expect(service.decide(account, 'mum@example.com', 'prescriptions')).toEqual({
      allowed: false,
      reason: 'scope_not_granted',
    });
  });

  it('denies an unknown caregiver', () => {
    const account = activeAccountWithGrant();
    expect(service.decide(account, 'stranger@example.com', 'appointments')).toEqual({
      allowed: false,
      reason: 'no_active_grant',
    });
  });

  it('denies when the account is not active', () => {
    const account = activeAccountWithGrant();
    account.suspend('hold');
    expect(service.decide(account, 'mum@example.com', 'appointments')).toEqual({
      allowed: false,
      reason: 'account_not_active',
    });
  });
});
