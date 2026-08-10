import 'reflect-metadata';

import { PlatformDashboardController } from '../platform-dashboard.controller';

import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';

import { PLATFORM_PERMISSION_KEY } from '../../auth/api/decorators/require-platform-permission.decorator';

import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

import type { PlatformDashboardService } from '../application/platform-dashboard.service';



const CLAIMS = { sub: 'u1' } as unknown as JwtClaimsVO;



describe('PlatformDashboardController boundary', () => {

  it('is marked as a platform-auth route (rejects tenant/patient tokens via the global JWT guard)', () => {

    const meta = Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformDashboardController);

    expect(meta).toBe(true);

  });



  it('does NOT gate the whole endpoint with a single platform permission (per-metric auth instead)', () => {

    const classPermission = Reflect.getMetadata(PLATFORM_PERMISSION_KEY, PlatformDashboardController);

    expect(classPermission).toBeUndefined();

    const handlerPermission = Reflect.getMetadata(

      PLATFORM_PERMISSION_KEY,

      PlatformDashboardController.prototype.getDashboard,

    );

    expect(handlerPermission).toBeUndefined();

  });



  it('GET loads the dashboard without refresh; POST refresh bypasses cache', async () => {

    const getDashboard = jest.fn().mockResolvedValue({ metrics: [] });

    const controller = new PlatformDashboardController({

      getDashboard,

    } as unknown as PlatformDashboardService);



    await controller.getDashboard(CLAIMS);

    expect(getDashboard).toHaveBeenCalledWith(CLAIMS);



    await controller.refreshDashboard(CLAIMS);

    expect(getDashboard).toHaveBeenLastCalledWith(CLAIMS, { refresh: true });

  });

});


