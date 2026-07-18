import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { InvitePortalAccountHandler } from '../application/handlers/invite-portal-account.handler';
import { InMemoryPortalAccountRepository } from '../infrastructure/in-memory-portal-account.repository';
import { PatientPortalPolicy } from '../policies/patient-portal-policy.service';
import { PortalDomainError } from '../domain/exceptions/portal-domain.exception';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  PORTAL_ACCOUNT_REPOSITORY,
  PORTAL_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../infrastructure/provider.tokens';
import { FakePortalAuditLog } from './support/fake-portal-audit-log';

describe('InvitePortalAccountHandler', () => {
  let handler: InvitePortalAccountHandler;
  let repository: InMemoryPortalAccountRepository;
  let audit: FakePortalAuditLog;
  const publish = jest.fn();

  beforeEach(async () => {
    publish.mockReset();
    audit = new FakePortalAuditLog();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvitePortalAccountHandler,
        PatientPortalPolicy,
        { provide: PORTAL_ACCOUNT_REPOSITORY, useClass: InMemoryPortalAccountRepository },
        { provide: PORTAL_AUDIT_LOG, useValue: audit },
        {
          provide: TenantContextService,
          useValue: { resolve: async () => ({ tenantId: 'tenant-1', branchId: 'branch-1', locale: 'ar' }) },
        },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
      ],
    }).compile();

    handler = module.get(InvitePortalAccountHandler);
    repository = module.get(PORTAL_ACCOUNT_REPOSITORY);
  });

  it('invites a patient, persists, publishes, and audits', async () => {
    const result = await handler.execute({
      patientId: 'patient-1',
      invitedBy: 'staff-1',
      invitedByRoles: ['receptionist'],
      locale: null,
      correlationId: 'corr-1',
    });

    expect(result).toHaveProperty('portalAccountId');
    const stored = await repository.findById(result.portalAccountId, 'tenant-1');
    expect(stored?.status.value).toBe('invited');
    // Falls back to tenant locale when none supplied.
    expect(stored?.preferences.locale).toBe('ar');
    expect(publish).toHaveBeenCalledTimes(1);
    expect(audit.records).toHaveLength(1);
    expect(audit.records[0].action).toBe('patient_portal.account.invited');
  });

  it('uses the explicit locale when provided', async () => {
    const result = await handler.execute({
      patientId: 'patient-2',
      invitedBy: 'staff-1',
      invitedByRoles: ['receptionist'],
      locale: 'en',
      correlationId: null,
    });
    const stored = await repository.findById(result.portalAccountId, 'tenant-1');
    expect(stored?.preferences.locale).toBe('en');
  });

  it('rejects a second invitation for the same patient (one account per patient)', async () => {
    await handler.execute({
      patientId: 'patient-1',
      invitedBy: 'staff-1',
      invitedByRoles: ['receptionist'],
      locale: null,
      correlationId: null,
    });

    await expect(
      handler.execute({
        patientId: 'patient-1',
        invitedBy: 'staff-1',
        invitedByRoles: ['receptionist'],
        locale: null,
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(PortalDomainError);
  });

  it('forbids unauthorized roles', async () => {
    await expect(
      handler.execute({
        patientId: 'patient-1',
        invitedBy: 'patient-self',
        invitedByRoles: ['patient'],
        locale: null,
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
