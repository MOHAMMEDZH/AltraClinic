import { ForbiddenException } from '@nestjs/common';
import { assertPortalAccountOwner } from '../application/handlers/portal-ownership.guard';
import { PortalAccount } from '../domain/entities/portal-account.entity';

describe('assertPortalAccountOwner', () => {
  function activeAccount(): PortalAccount {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      invitedBy: 'staff-1',
    });
    account.activate('user-9');
    return account;
  }

  it('passes for the owning user', () => {
    const account = activeAccount();
    expect(() => assertPortalAccountOwner(account, 'user-9', 'do thing')).not.toThrow();
  });

  it('throws for a different user', () => {
    const account = activeAccount();
    expect(() => assertPortalAccountOwner(account, 'intruder', 'do thing')).toThrow(ForbiddenException);
  });

  it('throws when the account has no bound user yet', () => {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      invitedBy: 'staff-1',
    });
    expect(() => assertPortalAccountOwner(account, 'user-9', 'do thing')).toThrow(ForbiddenException);
  });

  it('throws for a blank actor id', () => {
    const account = activeAccount();
    expect(() => assertPortalAccountOwner(account, '   ', 'do thing')).toThrow(ForbiddenException);
  });
});
