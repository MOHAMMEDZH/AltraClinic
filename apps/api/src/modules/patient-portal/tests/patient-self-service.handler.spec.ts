import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { UpdatePortalPreferencesHandler } from '../application/handlers/update-portal-preferences.handler';
import { GrantCaregiverAccessHandler } from '../application/handlers/grant-caregiver-access.handler';
import { RevokeCaregiverAccessHandler } from '../application/handlers/revoke-caregiver-access.handler';
import { InMemoryPortalAccountRepository } from '../infrastructure/in-memory-portal-account.repository';
import { PortalAccount } from '../domain/entities/portal-account.entity';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../infrastructure/provider.tokens';
import { FakePortalAuditLog } from './support/fake-portal-audit-log';

describe('Patient self-service handlers (ownership-gated)', () => {
  let updatePreferences: UpdatePortalPreferencesHandler;
  let grant: GrantCaregiverAccessHandler;
  let revoke: RevokeCaregiverAccessHandler;
  let repository: InMemoryPortalAccountRepository;
  let audit: FakePortalAuditLog;
  const publish = jest.fn();
  const OWNER = 'user-9';

  beforeEach(async () => {
    publish.mockReset();
    audit = new FakePortalAuditLog();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePortalPreferencesHandler,
        GrantCaregiverAccessHandler,
        RevokeCaregiverAccessHandler,
        { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: InMemoryPortalAccountRepository },
        { provide: PORTAL_AUDIT_LOG, useValue: audit },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', locale: 'en' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
      ],
    }).compile();

    updatePreferences = module.get(UpdatePortalPreferencesHandler);
    grant = module.get(GrantCaregiverAccessHandler);
    revoke = module.get(RevokeCaregiverAccessHandler);
    repository = module.get(PORTAL_ACCOUNT_REPOSITORY);
  });

  async function seedActive(): Promise<string> {
    const account = PortalAccount.invite({
      tenantId: 'tenant-1',
      branchId: 'branch-1',
      patientId: 'patient-1',
      invitedBy: 'staff-1',
    });
    account.activate(OWNER);
    await repository.save(account);
    return account.id;
  }

  it('lets the owner update preferences and publishes the change', async () => {
    const id = await seedActive();
    await updatePreferences.execute({
      portalAccountId: id,
      locale: 'ar',
      channels: { email: false, sms: true, push: true },
      actorId: OWNER,
      actorRoles: ['patient'],
      correlationId: null,
    });
    const stored = await repository.findById(id, 'tenant-1');
    expect(stored?.preferences.locale).toBe('ar');
    expect(stored?.preferences.channels.push).toBe(true);
    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('does not publish when preferences are unchanged', async () => {
    const id = await seedActive();
    await updatePreferences.execute({
      portalAccountId: id,
      locale: 'en',
      channels: { email: true, sms: true, push: false },
      actorId: OWNER,
      actorRoles: ['patient'],
      correlationId: null,
    });
    expect(publish).not.toHaveBeenCalled();
  });

  it('forbids a non-owner from updating preferences', async () => {
    const id = await seedActive();
    await expect(
      updatePreferences.execute({
        portalAccountId: id,
        locale: 'ar',
        channels: { email: true, sms: true, push: false },
        actorId: 'intruder',
        actorRoles: ['patient'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('lets the owner grant and revoke caregiver access (audited)', async () => {
    const id = await seedActive();
    const { grantId } = await grant.execute({
      portalAccountId: id,
      caregiverContact: 'mum@example.com',
      caregiverName: 'Mum',
      scopes: ['appointments', 'billing'],
      expiresAt: null,
      actorId: OWNER,
      actorRoles: ['patient'],
      correlationId: null,
    });
    expect(grantId).toBeDefined();
    expect(audit.records.some((r) => r.action === 'patient_portal.caregiver_access.granted')).toBe(true);

    await revoke.execute({
      portalAccountId: id,
      grantId,
      reason: 'no longer needed',
      actorId: OWNER,
      actorRoles: ['patient'],
      correlationId: null,
    });
    const stored = await repository.findById(id, 'tenant-1');
    expect(stored?.findGrant(grantId)?.isActive()).toBe(false);
    expect(audit.records.some((r) => r.action === 'patient_portal.caregiver_access.revoked')).toBe(true);
  });

  it('forbids a non-owner from granting caregiver access (consent is personal)', async () => {
    const id = await seedActive();
    await expect(
      grant.execute({
        portalAccountId: id,
        caregiverContact: 'mum@example.com',
        caregiverName: 'Mum',
        scopes: ['appointments'],
        expiresAt: null,
        actorId: 'staff-1',
        actorRoles: ['admin'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
