import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformTenantsController } from '../api/platform-tenants.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import {
  JwtClaimsVO,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';

describe('Platform Tenants auth boundary', () => {
  it('controller class is marked @PlatformAuthRoute() on platform/tenant-directory path', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformTenantsController)).toBe(true);
  });

  describe('JwtAuthGuard audience boundary', () => {
    function mockContext(isPlatformRoute: boolean, user: JwtClaimsVO | null) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return isPlatformRoute;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => PlatformTenantsController.prototype.list,
        getClass: () => PlatformTenantsController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      return { guard, ctx };
    }

    it('rejects clinic token on platform tenant-directory routes', () => {
      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: ['super_admin'] as never,
        sessionId: 's',
        sessionClass: 'staff',
      });
      const { guard, ctx } = mockContext(true, clinic);
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(UnauthorizedException);
    });

    it('accepts platform token on platform tenant-directory routes', () => {
      const platform = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });
      const { guard, ctx } = mockContext(true, platform);
      expect(guard.handleRequest(null, platform as never, null, ctx)).toBe(platform);
    });
  });
});
