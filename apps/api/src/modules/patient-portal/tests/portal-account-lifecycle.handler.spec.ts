import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ActivatePortalAccountHandler } from '../application/handlers/activate-portal-account.handler';
import { SuspendPortalAccountHandler } from '../application/handlers/suspend-portal-account.handler';
import { ReactivatePortalAccountHandler } from '../application/handlers/reactivate-portal-account.handler';
import { DeactivatePortalAccountHandler } from '../application/handlers/deactivate-portal-account.handler';
import { InMemoryPortalAccountRepository } from '../infrastructure/in-memory-portal-account.repository';
import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../infrastructure/provider.tokens';
import { FakePortalAuditLog } from './support/fake-portal-audit-log';

describe('Portal account lifecycle handlers', () => {
  let activate: ActivatePortalAccountHandler;
  let suspend: SuspendPortalAccountHandler;
  let reactivate: ReactivatePortalAccountHandler;
  let deactivate: DeactivatePortalAccountHandler;
  let repository: InMemoryPortalAccountRepository;
  let audit: FakePortalAuditLog;
  const publish = jest.fn();

  beforeEach(async () => {
    publish.mockReset();
    audit = new FakePortalAuditLog();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivatePortalAccountHandler,
        SuspendPortalAccountHandler,
        ReactivatePortalAccountHandler,
        DeactivatePortalAccountHandler,
        PatientPortalPolicy,
        { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: InMemoryPortalAccountRepository },
        { provide: PORTAL_AUDIT_LOG, useValue: audit },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', locale: 'en' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
      ],
    }).compile();

    activate = module.get(ActivatePortalAccountHandler);
    suspend = module.get(SuspendPortalAccountHandler);
    reactivate = module.get(ReactivatePortalAccountHandler);
    deactivate = module.get(DeactivatePortalAccountHandler);
    repository = module.get(PORTAL_ACCOUNT_REPOSITORY);
  });

  async function seedInvited(): Promise<string> {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      invitedBy: 'staff-1',
    });
    await repository.save(account);
    return account.id;
  }

  it('activates an invited account', async () => {
    const id = await seedInvited();
    await activate.execute({
      portalAccountId: id,
      userId: 'user-9',
      actorId: 'staff-1',
      actorRoles: ['receptionist'],
      correlationId: null,
    });
    const stored = await repository.findById(id, 'tenant-1');
    expect(stored?.status.value).toBe('active');
    expect(stored?.userId).toBe('user-9');
    expect(audit.records.some((r) => r.action === 'patient_portal.account.activated')).toBe(true);
  });

  it('forbids governance actions for receptionists', async () => {
    const id = await seedInvited();
    await activate.execute({
      portalAccountId: id,
      userId: 'user-9',
      actorId: 'staff-1',
      actorRoles: ['receptionist'],
      correlationId: null,
    });

    await expect(
      suspend.execute({
        portalAccountId: id,
        reason: 'fraud check',
        actorId: 'staff-1',
        actorRoles: ['receptionist'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('suspends and reactivates an active account', async () => {
    const id = await seedInvited();
    await activate.execute({
      portalAccountId: id,
      userId: 'user-9',
      actorId: 'staff-1',
      actorRoles: ['clinic_manager'],
      correlationId: null,
    });
    await suspend.execute({
      portalAccountId: id,
      reason: 'fraud check',
      actorId: 'mgr-1',
      actorRoles: ['clinic_manager'],
      correlationId: null,
    });
    expect((await repository.findById(id, 'tenant-1'))?.status.value).toBe('suspended');

    await reactivate.execute({
      portalAccountId: id,
      actorId: 'mgr-1',
      actorRoles: ['clinic_manager'],
      correlationId: null,
    });
    expect((await repository.findById(id, 'tenant-1'))?.status.value).toBe('active');
  });

  it('deactivates and cascades caregiver revocation events', async () => {
    const id = await seedInvited();
    const account = await repository.findById(id, 'tenant-1');
    account!.activate('user-9');
    account!.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: 'user-9',
      expiresAt: null,
    });
    await repository.save(account!);
    publish.mockReset();

    await deactivate.execute({
      portalAccountId: id,
      reason: 'patient left',
      actorId: 'mgr-1',
      actorRoles: ['tenant_admin'],
      correlationId: null,
    });

    const stored = await repository.findById(id, 'tenant-1');
    expect(stored?.status.value).toBe('deactivated');
    expect(stored?.activeCaregiverGrants()).toHaveLength(0);
    // One deactivated event + one cascaded caregiver-revoked event.
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('throws NotFound for an unknown account', async () => {
    await expect(
      activate.execute({
        portalAccountId: 'missing',
        userId: 'user-9',
        actorId: 'staff-1',
        actorRoles: ['receptionist'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
