import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetPortalAccountHandler } from '../application/handlers/get-portal-account.handler';
import { ListPortalAccountsHandler } from '../application/handlers/list-portal-accounts.handler';
import { InMemoryPortalAccountRepository } from '../infrastructure/in-memory-portal-account.repository';
import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import { PORTAL_ACCOUNT_REPOSITORY } from '../../../infrastructure/provider.tokens';

describe('Portal account query handlers', () => {
  let get: GetPortalAccountHandler;
  let list: ListPortalAccountsHandler;
  let repository: InMemoryPortalAccountRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPortalAccountHandler,
        ListPortalAccountsHandler,
        PatientPortalPolicy,
        { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: InMemoryPortalAccountRepository },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', locale: 'en' }) },
        },
      ],
    }).compile();

    get = module.get(GetPortalAccountHandler);
    list = module.get(ListPortalAccountsHandler);
    repository = module.get(PORTAL_ACCOUNT_REPOSITORY);
  });

  async function seedActive(patientId: string, userId: string): Promise<string> {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId,
      invitedBy: 'staff-1',
    });
    account.activate(userId);
    await repository.save(account);
    return account.id;
  }

  async function seedActiveWithGrant(patientId: string, userId: string): Promise<string> {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId,
      invitedBy: 'staff-1',
    });
    account.activate(userId);
    account.grantCaregiverAccess({
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments'],
      grantedBy: userId,
      expiresAt: null,
    });
    await repository.save(account);
    return account.id;
  }

  it('lets staff read any account', async () => {
    const id = await seedActive('patient-1', 'user-1');
    const dto = await get.execute({ portalAccountId: id, actorId: 'staff-1', actorRoles: ['receptionist'] });
    expect(dto.portalAccountId).toBe(id);
  });

  it('redacts caregiver PII from staff (non-owner) viewers', async () => {
    const id = await seedActiveWithGrant('patient-1', 'user-1');
    const dto = await get.execute({ portalAccountId: id, actorId: 'staff-1', actorRoles: ['receptionist'] });
    expect(dto.caregiverGrants).toHaveLength(1);
    // Grant existence/metadata visible, but contact PII redacted.
    expect(dto.caregiverGrants[0].grantId).toBeDefined();
    expect(dto.caregiverGrants[0].scopes).toEqual(['appointments']);
    expect(dto.caregiverGrants[0].caregiverContact).toBeNull();
    expect(dto.caregiverGrants[0].caregiverName).toBeNull();
  });

  it('shows caregiver PII to the owning patient', async () => {
    const id = await seedActiveWithGrant('patient-1', 'user-1');
    const dto = await get.execute({ portalAccountId: id, actorId: 'user-1', actorRoles: ['patient'] });
    expect(dto.caregiverGrants[0].caregiverContact).toBe('mum@example.com');
    expect(dto.caregiverGrants[0].caregiverName).toBe('Mum');
  });

  it('redacts caregiver PII in staff list results', async () => {
    await seedActiveWithGrant('patient-1', 'user-1');
    const page = await list.execute({
      branchId: null,
      status: null,
      patientId: null,
      limit: 20,
      offset: 0,
      actorRoles: ['admin'],
    });
    expect(page.items[0].caregiverGrants[0].caregiverContact).toBeNull();
  });

  it('lets the owner read their own account', async () => {
    const id = await seedActive('patient-1', 'user-1');
    const dto = await get.execute({ portalAccountId: id, actorId: 'user-1', actorRoles: ['patient'] });
    expect(dto.userId).toBe('user-1');
  });

  it('forbids a patient from reading another patient account', async () => {
    const id = await seedActive('patient-1', 'user-1');
    await expect(
      get.execute({ portalAccountId: id, actorId: 'user-2', actorRoles: ['patient'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound for an unknown account', async () => {
    await expect(
      get.execute({ portalAccountId: 'missing', actorId: 'staff-1', actorRoles: ['admin'] }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists accounts for staff with pagination metadata', async () => {
    await seedActive('patient-1', 'user-1');
    await seedActive('patient-2', 'user-2');
    await seedActive('patient-3', 'user-3');

    const page = await list.execute({
      branchId: null,
      status: null,
      patientId: null,
      limit: 2,
      offset: 0,
      actorRoles: ['admin'],
    });
    expect(page.total).toBe(3);
    expect(page.items).toHaveLength(2);
    expect(page.limit).toBe(2);
  });

  it('clamps an oversized limit to the maximum', async () => {
    await seedActive('patient-1', 'user-1');
    const page = await list.execute({
      branchId: null,
      status: null,
      patientId: null,
      limit: 10_000,
      offset: 0,
      actorRoles: ['admin'],
    });
    expect(page.limit).toBe(100);
  });

  it('forbids patients from listing accounts', async () => {
    await expect(
      list.execute({
        branchId: null,
        status: null,
        patientId: null,
        limit: 20,
        offset: 0,
        actorRoles: ['patient'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('filters by status', async () => {
    const activeId = await seedActive('patient-1', 'user-1');
    const invited = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-2',
      invitedBy: 'staff-1',
    });
    await repository.save(invited);

    const page = await list.execute({
      branchId: null,
      status: 'active',
      patientId: null,
      limit: 20,
      offset: 0,
      actorRoles: ['admin'],
    });
    expect(page.total).toBe(1);
    expect(page.items[0].portalAccountId).toBe(activeId);
  });
});
