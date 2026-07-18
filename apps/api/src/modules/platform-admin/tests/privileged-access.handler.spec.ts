import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ProvisionPlatformTenantHandler } from '../application/handlers/provision-platform-tenant.handler';
import { ActivatePlatformTenantHandler } from '../application/handlers/activate-platform-tenant.handler';
import { RequestPrivilegedAccessHandler } from '../application/handlers/request-privileged-access.handler';
import { ApprovePrivilegedAccessHandler } from '../application/handlers/approve-privileged-access.handler';
import { RejectPrivilegedAccessHandler } from '../application/handlers/reject-privileged-access.handler';
import { RevokePrivilegedAccessHandler } from '../application/handlers/revoke-privileged-access.handler';
import { InMemoryPlatformTenantRepository } from '../infrastructure/in-memory-platform-tenant.repository';
import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';
import { PlatformAdminValidationError } from '../domain/exceptions/platform-admin.exception';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  PLATFORM_TENANT_REPOSITORY,
  PLATFORM_ADMIN_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../infrastructure/provider.tokens';
import { FakePlatformAdminAuditLog } from './support/fake-platform-admin-audit-log';

const SUPER_ADMIN = ['system_administrator'];
const future = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe('Privileged access handlers', () => {
  let provision: ProvisionPlatformTenantHandler;
  let activate: ActivatePlatformTenantHandler;
  let requestAccess: RequestPrivilegedAccessHandler;
  let approve: ApprovePrivilegedAccessHandler;
  let reject: RejectPrivilegedAccessHandler;
  let revoke: RevokePrivilegedAccessHandler;
  let repository: InMemoryPlatformTenantRepository;
  let audit: FakePlatformAdminAuditLog;
  const publish = jest.fn();

  beforeEach(async () => {
    publish.mockReset();
    audit = new FakePlatformAdminAuditLog();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProvisionPlatformTenantHandler,
        ActivatePlatformTenantHandler,
        RequestPrivilegedAccessHandler,
        ApprovePrivilegedAccessHandler,
        RejectPrivilegedAccessHandler,
        RevokePrivilegedAccessHandler,
        PlatformAdminPolicy,
        { provide: PLATFORM_TENANT_REPOSITORY, useClass: InMemoryPlatformTenantRepository },
        { provide: PLATFORM_ADMIN_AUDIT_LOG, useValue: audit },
        { provide: TenantContextService, useValue: { resolve: async () => ({ tenantId: 'ops', locale: 'ar' }) } },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
      ],
    }).compile();

    provision = module.get(ProvisionPlatformTenantHandler);
    activate = module.get(ActivatePlatformTenantHandler);
    requestAccess = module.get(RequestPrivilegedAccessHandler);
    approve = module.get(ApprovePrivilegedAccessHandler);
    reject = module.get(RejectPrivilegedAccessHandler);
    revoke = module.get(RevokePrivilegedAccessHandler);
    repository = module.get(PLATFORM_TENANT_REPOSITORY);
  });

  async function seedActive(): Promise<string> {
    const { platformTenantId } = await provision.execute({
      tenantId: 'tenant-1',
      displayName: 'Acme',
      region: 'me-central',
      plan: 'starter',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    await activate.execute({
      platformTenantId,
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    return platformTenantId;
  }

  it('requests standard access as pending and emits a Requested event', async () => {
    const id = await seedActive();
    publish.mockReset();
    const { grantId, status } = await requestAccess.execute({
      platformTenantId: id,
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'support investigation needed',
      expiresAt: future(),
      breakGlass: false,
      actorId: 'admin-2',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    expect(status).toBe('pending_approval');
    expect(grantId).toBeTruthy();
    expect(publish.mock.calls[0][0].eventName).toBe('PrivilegedAccessRequested');
    expect(audit.records.some((r) => r.action === 'platform_admin.privileged_access.requested')).toBe(true);
  });

  it('activates break-glass immediately and emits a Granted event', async () => {
    const id = await seedActive();
    publish.mockReset();
    const { status } = await requestAccess.execute({
      platformTenantId: id,
      adminName: 'Ops Two',
      scopes: ['emergency_write'],
      justification: 'production outage break glass',
      expiresAt: future(),
      breakGlass: true,
      actorId: 'admin-2',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    expect(status).toBe('active');
    const granted = publish.mock.calls[0][0];
    expect(granted.eventName).toBe('PrivilegedAccessGranted');
    expect(granted.breakGlass).toBe(true);
    expect(audit.records.some((r) => r.action === 'platform_admin.privileged_access.break_glass')).toBe(true);
  });

  it('enforces separation of duties: requester cannot approve own grant', async () => {
    const id = await seedActive();
    const { grantId } = await requestAccess.execute({
      platformTenantId: id,
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'support investigation needed',
      expiresAt: future(),
      breakGlass: false,
      actorId: 'admin-2',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    await expect(
      approve.execute({
        platformTenantId: id,
        grantId,
        actorId: 'admin-2',
        actorRoles: SUPER_ADMIN,
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(PlatformAdminValidationError);

    await approve.execute({
      platformTenantId: id,
      grantId,
      actorId: 'admin-9',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    const tenant = await repository.findById(id);
    expect(tenant?.findGrant(grantId)?.status).toBe('active');
    expect(tenant?.findGrant(grantId)?.approvedBy).toBe('admin-9');
  });

  it('rejects a pending grant by a different reviewer', async () => {
    const id = await seedActive();
    const { grantId } = await requestAccess.execute({
      platformTenantId: id,
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'support investigation needed',
      expiresAt: future(),
      breakGlass: false,
      actorId: 'admin-2',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    await reject.execute({
      platformTenantId: id,
      grantId,
      reason: 'insufficient justification',
      actorId: 'admin-9',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    expect((await repository.findById(id))?.findGrant(grantId)?.status).toBe('rejected');
  });

  it('revokes an active break-glass grant', async () => {
    const id = await seedActive();
    const { grantId } = await requestAccess.execute({
      platformTenantId: id,
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'temporary break glass access',
      expiresAt: future(),
      breakGlass: true,
      actorId: 'admin-2',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    await revoke.execute({
      platformTenantId: id,
      grantId,
      reason: 'work complete',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    expect((await repository.findById(id))?.findGrant(grantId)?.status).toBe('revoked');
  });

  it('forbids non-super-admins from requesting privileged access', async () => {
    const id = await seedActive();
    await expect(
      requestAccess.execute({
        platformTenantId: id,
        adminName: 'Imposter',
        scopes: ['support'],
        justification: 'should not be allowed at all',
        expiresAt: future(),
        breakGlass: false,
        actorId: 'mgr-1',
        actorRoles: ['tenant_admin'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
