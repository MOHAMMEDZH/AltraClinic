import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { GetPlatformTenantHandler } from '../application/handlers/get-platform-tenant.handler';
import { ListPlatformTenantsHandler } from '../application/handlers/list-platform-tenants.handler';
import { InMemoryPlatformTenantRepository } from '../infrastructure/in-memory-platform-tenant.repository';
import { PlatformAdminPolicy } from '../policies/platform-admin-policy.service';
import { PlatformTenant } from '../domain/entities/platform-tenant.entity';
import { PLATFORM_TENANT_REPOSITORY } from '../../../infrastructure/provider.tokens';

const SUPER_ADMIN = ['system_administrator'];

describe('Platform tenant query handlers', () => {
  let get: GetPlatformTenantHandler;
  let list: ListPlatformTenantsHandler;
  let repository: InMemoryPlatformTenantRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPlatformTenantHandler,
        ListPlatformTenantsHandler,
        PlatformAdminPolicy,
        { provide: PLATFORM_TENANT_REPOSITORY, useClass: InMemoryPlatformTenantRepository },
      ],
    }).compile();

    get = module.get(GetPlatformTenantHandler);
    list = module.get(ListPlatformTenantsHandler);
    repository = module.get(PLATFORM_TENANT_REPOSITORY);
  });

  async function seed(tenantId: string, displayName: string, region: string, plan: string): Promise<PlatformTenant> {
    const tenant = PlatformTenant.provision({
      tenantId,
      displayName,
      region,
      plan,
      provisionedBy: 'admin-1',
    });
    await repository.save(tenant);
    return tenant;
  }

  it('gets a platform tenant by id for a super admin', async () => {
    const tenant = await seed('tenant-1', 'Acme', 'me-central', 'starter');
    const dto = await get.execute({ platformTenantId: tenant.id, actorId: 'admin-1', actorRoles: SUPER_ADMIN });
    expect(dto.tenantId).toBe('tenant-1');
    expect(dto.planLimits).toEqual({ maxBranches: 1, maxUsers: 10 });
  });

  it('forbids viewing for non-super-admins', async () => {
    const tenant = await seed('tenant-1', 'Acme', 'me-central', 'starter');
    await expect(
      get.execute({ platformTenantId: tenant.id, actorId: 'mgr', actorRoles: ['tenant_admin'] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws NotFound for unknown tenant', async () => {
    await expect(
      get.execute({ platformTenantId: 'missing', actorId: 'admin-1', actorRoles: SUPER_ADMIN }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('lists with region/plan filters and search', async () => {
    await seed('tenant-1', 'Acme Dental', 'me-central', 'starter');
    await seed('tenant-2', 'Beauty Spa', 'eu-west', 'growth');
    await seed('tenant-3', 'Acme Medical', 'me-central', 'enterprise');

    const byRegion = await list.execute({
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      status: null,
      region: 'me-central',
      plan: null,
      search: null,
      limit: 25,
      offset: 0,
    });
    expect(byRegion.total).toBe(2);

    const bySearch = await list.execute({
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      status: null,
      region: null,
      plan: null,
      search: 'acme',
      limit: 25,
      offset: 0,
    });
    expect(bySearch.total).toBe(2);
  });

  it('clamps the page size to the maximum', async () => {
    const page = await list.execute({
      actorId: 'admin-1',
      actorRoles: SUPER_ADMIN,
      status: null,
      region: null,
      plan: null,
      search: null,
      limit: 10_000,
      offset: 0,
    });
    expect(page.limit).toBe(ListPlatformTenantsHandler.MAX_LIMIT);
  });

  it('forbids listing for non-super-admins', async () => {
    await expect(
      list.execute({
        actorId: 'mgr',
        actorRoles: ['receptionist'],
        status: null,
        region: null,
        plan: null,
        search: null,
        limit: 25,
        offset: 0,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
