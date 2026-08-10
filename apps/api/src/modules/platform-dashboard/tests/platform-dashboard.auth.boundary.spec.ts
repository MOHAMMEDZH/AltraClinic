/**
 * Release 47 Step 10 — Platform Dashboard auth boundary (unit-level).
 *
 * Full HTTP e2e is deferred; token audience rejection on platform routes is
 * covered by Phase 47 Step 06 suites (`platform-auth.boundary.spec.ts`) and
 * the global JwtAuthGuard audience checks exercised there.
 */
import 'reflect-metadata';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PlatformDashboardController } from '../platform-dashboard.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import {
  JwtClaimsVO,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';

describe('Platform Dashboard auth boundary', () => {
  it('controller class is marked @PlatformAuthRoute()', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformDashboardController)).toBe(true);
  });

  it('POST refresh handler inherits platform-auth route metadata from the controller class', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformDashboardController)).toBe(true);
    expect(typeof PlatformDashboardController.prototype.refreshDashboard).toBe('function');
  });

  describe('JwtAuthGuard audience boundary (Step 06 pattern)', () => {
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
        getHandler: () => PlatformDashboardController.prototype.getDashboard,
        getClass: () => PlatformDashboardController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      return { guard, ctx };
    }

    it('rejects clinic token on platform dashboard routes', () => {
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

    it('accepts platform token on platform dashboard routes', () => {
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
