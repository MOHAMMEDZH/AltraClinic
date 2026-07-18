import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ProvisionPlatformTenantHandler } from '../application/handlers/provision-platform-tenant.handler';
import { ActivatePlatformTenantHandler } from '../application/handlers/activate-platform-tenant.handler';
import { SuspendPlatformTenantHandler } from '../application/handlers/suspend-platform-tenant.handler';
import { ResumePlatformTenantHandler } from '../application/handlers/resume-platform-tenant.handler';
import { ArchivePlatformTenantHandler } from '../application/handlers/archive-platform-tenant.handler';
import { ChangePlatformTenantPlanHandler } from '../application/handlers/change-platform-tenant-plan.handler';
import { InMemoryPlatformTenantRepository } from '../infrastructure/in-memory-platform-tenant.repository';
import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';
import { TenantContextService } from '../../../infrastructure/tenant-context.service';
import {
  PLATFORM_TENANT_REPOSITORY,
  PLATFORM_ADMIN_AUDIT_LOG,
  EVENT_PUBLISHER,
} from '../../../infrastructure/provider.tokens';
import { FakePlatformAdminAuditLog } from './support/fake-platform-admin-audit-log';

const SUPER_ADMIN = ['system_administrator'];

describe('Platform tenant lifecycle handlers', () => {
  let provision: ProvisionPlatformTenantHandler;
  let activate: ActivatePlatformTenantHandler;
  let suspend: SuspendPlatformTenantHandler;
  let resume: ResumePlatformTenantHandler;
  let archive: ArchivePlatformTenantHandler;
  let changePlan: ChangePlatformTenantPlanHandler;
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
        SuspendPlatformTenantHandler,
        ResumePlatformTenantHandler,
        ArchivePlatformTenantHandler,
        ChangePlatformTenantPlanHandler,
        PlatformAdminPolicy,
        { provide: PLATFORM_TENANT_REPOSITORY, useClass: InMemoryPlatformTenantRepository },
        { provide: PLATFORM_ADMIN_AUDIT_LOG, useValue: audit },
        { provide: TenantContextService, useValue: { resolve: async () => ({ tenantId: 'ops', locale: 'en' }) } },
        { provide: EVENT_PUBLISHER, useValue: { publish } },
      ],
    }).compile();

    provision = module.get(ProvisionPlatformTenantHandler);
    activate = module.get(ActivatePlatformTenantHandler);
    suspend = module.get(SuspendPlatformTenantHandler);
    resume = module.get(ResumePlatformTenantHandler);
    archive = module.get(ArchivePlatformTenantHandler);
    changePlan = module.get(ChangePlatformTenantPlanHandler);
    repository = module.get(PLATFORM_TENANT_REPOSITORY);
  });

  async function seedProvisioned(): Promise<string> {
    const { platformTenantId } = await provision.execute({
      tenantId: 'tenant-1',
      displayName: 'Acme Dental',
      region: 'me-central',
      plan: 'starter',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    return platformTenantId;
  }

  it('provisions a platform tenant and audits it', async () => {
    const id = await seedProvisioned();
    const stored = await repository.findById(id);
    expect(stored?.status.value).toBe('provisioning');
    expect(audit.records.some((r) => r.action === 'platform_admin.tenant.provisioned')).toBe(true);
    expect(audit.records[0].descriptionAr).toBeTruthy();
  });

  it('rejects duplicate provisioning for the same tenant', async () => {
    await seedProvisioned();
    await expect(
      provision.execute({
        tenantId: 'tenant-1',
        displayName: 'Acme Dup',
        region: 'me-central',
        plan: 'starter',
        actorId: 'admin-1',
        actorRoles: SUPER_ADMIN,
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('forbids non-super-admins from provisioning', async () => {
    await expect(
      provision.execute({
        tenantId: 'tenant-x',
        displayName: 'X',
        region: 'eu-west',
        plan: 'starter',
        actorId: 'mgr-1',
        actorRoles: ['tenant_admin'],
        correlationId: null,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('runs the activate → suspend → resume lifecycle', async () => {
    const id = await seedProvisioned();
    await activate.execute({ platformTenantId: id, actorId: 'admin-1', actorRoles: SUPER_ADMIN, correlationId: null });
    expect((await repository.findById(id))?.status.value).toBe('active');

    await suspend.execute({
      platformTenantId: id,
      reason: 'non-payment',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    expect((await repository.findById(id))?.status.value).toBe('suspended');

    await resume.execute({ platformTenantId: id, actorId: 'admin-1', actorRoles: SUPER_ADMIN, correlationId: null });
    expect((await repository.findById(id))?.status.value).toBe('active');
  });

  it('changes the plan and reports no-op for the same plan', async () => {
    const id = await seedProvisioned();
    const first = await changePlan.execute({
      platformTenantId: id,
      plan: 'growth',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    expect(first.changed).toBe(true);

    const second = await changePlan.execute({
      platformTenantId: id,
      plan: 'growth',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });
    expect(second.changed).toBe(false);
  });

  it('archives a tenant and cascades grant revocation events', async () => {
    const id = await seedProvisioned();
    await activate.execute({ platformTenantId: id, actorId: 'admin-1', actorRoles: SUPER_ADMIN, correlationId: null });
    const tenant = await repository.findById(id);
    tenant!.requestPrivilegedAccess({
      adminId: 'admin-2',
      adminName: 'Ops Two',
      scopes: ['support'],
      justification: 'incident before archive',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      breakGlass: true,
    });
    await repository.save(tenant!);
    publish.mockReset();

    await archive.execute({
      platformTenantId: id,
      reason: 'contract ended',
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      correlationId: null,
    });

    expect((await repository.findById(id))?.status.value).toBe('archived');
    const eventNames = publish.mock.calls.map((c) => c[0].eventName);
    expect(eventNames).toContain('PlatformTenantArchived');
    expect(eventNames).toContain('PrivilegedAccessRevoked');
  });

  it('throws NotFound for an unknown tenant', async () => {
    await expect(
      activate.execute({ platformTenantId: 'missing', actorId: 'admin-1', actorRoles: SUPER_ADMIN, correlationId: null }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
