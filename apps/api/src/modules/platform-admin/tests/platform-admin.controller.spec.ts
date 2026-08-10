import 'reflect-metadata';

import { PlatformAdminController } from '../api/platform-admin.controller';
import { PERMISSION_KEY } from '../../auth/api/guards/permission.guard';
import { ListPlatformTenantsHandler } from '../application/handlers/list-platform-tenants.handler';
import { GetPlatformTenantHandler } from '../application/handlers/get-platform-tenant.handler';

describe('PlatformAdminController legacy GET routes', () => {
  it('GET list uses RequirePermission api.platform_admin view and delegates to ListPlatformTenantsHandler', async () => {
    const permission = Reflect.getMetadata(PERMISSION_KEY, PlatformAdminController.prototype.list);
    expect(permission).toEqual({ resource: 'api.platform_admin', action: 'view' });

    const listHandler = { execute: jest.fn().mockResolvedValue({ items: [], total: 0, limit: 25, offset: 0 }) };
    const controller = new PlatformAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      listHandler as unknown as ListPlatformTenantsHandler,
      {} as never,
    );

    await controller.list(
      { user: { id: 'admin-1', roles: ['system_administrator'] } },
      'active',
      'me-central',
      'starter',
      'acme',
      '50',
      '10',
    );

    expect(listHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 'admin-1',
        actorRoles: ['system_administrator'],
        status: 'active',
        region: 'me-central',
        plan: 'starter',
        search: 'acme',
        limit: 50,
        offset: 10,
      }),
    );
  });

  it('GET detail uses RequirePermission api.platform_admin view and delegates to GetPlatformTenantHandler', async () => {
    const permission = Reflect.getMetadata(PERMISSION_KEY, PlatformAdminController.prototype.get);
    expect(permission).toEqual({ resource: 'api.platform_admin', action: 'view' });

    const getHandler = { execute: jest.fn().mockResolvedValue({ platformTenantId: 'pt-1' }) };
    const controller = new PlatformAdminController(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      getHandler as unknown as GetPlatformTenantHandler,
    );

    await controller.get('pt-1', { user: { id: 'admin-1', roles: ['system_administrator'] } });

    expect(getHandler.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        platformTenantId: 'pt-1',
        actorId: 'admin-1',
        actorRoles: ['system_administrator'],
      }),
    );
  });
});
