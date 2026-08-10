/**
 * U01 Usage Metering HTTP auth boundary — Platform JWT + usage.view; Clinic denied.
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { UsageMeteringPlatformController } from '../controllers/usage-metering-platform.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import {
  PLATFORM_PERMISSION_KEY,
} from '../../auth/api/decorators/require-platform-permission.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { PlatformPermissionGuard } from '../../auth/api/guards/platform-permission.guard';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import {
  JwtTokenService,
  type JwtConfig,
} from '../../auth/infrastructure/services/jwt-token.service';
import {
  JwtClaimsVO,
  PATIENT_PORTAL_TOKEN_AUDIENCE,
  PLATFORM_PREAUTH_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';

const HANDLERS: Array<keyof UsageMeteringPlatformController> = [
  'list',
  'get',
  'explain',
  'reconcile',
];

const PERMISSION_BY_HANDLER: Record<(typeof HANDLERS)[number], string> = {
  list: 'usage.view',
  get: 'usage.view',
  explain: 'usage.view',
  reconcile: 'usage.reconcile',
};

const JWT_CFG: JwtConfig = {
  accessSecret: 'clinic-access-secret-min-32-characters-xx',
  refreshSecret: 'clinic-refresh-secret-min-32-characters-x',
  accessExpiresIn: 900,
  refreshExpiresIn: 604800,
  mfaChallengeExpiresIn: 300,
  platformAccessSecret: 'platform-access-secret-min-32-chars-xx',
  platformRefreshSecret: 'platform-refresh-secret-min-32-chars-x',
  platformIssuer: 'booking-platform',
  platformAccessExpiresIn: 900,
  platformRefreshExpiresIn: 604800,
  platformSecretsSharedWithClinic: false,
};

describe('Platform Usage Metering HTTP auth boundary', () => {
  it('controller class is marked @PlatformAuthRoute()', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, UsageMeteringPlatformController)).toBe(
      true,
    );
  });

  it('exposes expected usage handlers', () => {
    for (const name of HANDLERS) {
      expect(typeof UsageMeteringPlatformController.prototype[name]).toBe('function');
    }
  });

  it('fails closed when Clinic/tenant markers; no @Public', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, UsageMeteringPlatformController)).toBe(
      true,
    );
    expect(Reflect.getMetadata('isTenantScoped', UsageMeteringPlatformController)).toBeUndefined();
    expect(Reflect.getMetadata('isClinicAuthRoute', UsageMeteringPlatformController)).toBeUndefined();
    expect(UsageMeteringPlatformController.toString()).not.toMatch(/@Public/);
  });

  it('GET list requires usage.view metadata', () => {
    expect(
      Reflect.getMetadata(PLATFORM_PERMISSION_KEY, UsageMeteringPlatformController.prototype.list),
    ).toBe('usage.view');
  });

  it('assigns RequirePlatformPermission per handler', () => {
    for (const name of HANDLERS) {
      expect(
        Reflect.getMetadata(PLATFORM_PERMISSION_KEY, UsageMeteringPlatformController.prototype[name]),
      ).toBe(PERMISSION_BY_HANDLER[name]);
    }
  });

  it('controller source sets Cache-Control private, no-store on handlers', () => {
    const src = readFileSync(
      join(__dirname, '../controllers/usage-metering-platform.controller.ts'),
      'utf8',
    );
    const headerCount = (src.match(/Cache-Control',\s*'private, no-store'/g) ?? []).length;
    expect(headerCount).toBeGreaterThanOrEqual(HANDLERS.length);
  });

  it('inspection service does not call LicensingEngineService or interactive activity APIs', () => {
    const source = readFileSync(
      join(__dirname, '../application/usage-inspection.service.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/LicensingEngineService/);
    expect(code).not.toMatch(/touchActivity|extendIdle|recordInteractiveActivity|bumpLastActivity/);
  });

  describe('JwtAuthGuard for GET /platform/tenants/:id/usage (list)', () => {
    function mockContext(user: JwtClaimsVO | null) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => UsageMeteringPlatformController.prototype.list,
        getClass: () => UsageMeteringPlatformController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      return { guard, ctx };
    }

    function platformClaims() {
      return new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: '11111111-1111-4111-8111-111111111111',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });
    }

    it('rejects missing/Clinic/patient/pre-auth; accepts Platform JWT', () => {
      const { guard, ctx: missing } = mockContext(null);
      expect(() => guard.handleRequest(null, null as never, null, missing)).toThrow(
        UnauthorizedException,
      );

      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: ['super_admin'] as never,
        sessionId: 's',
        sessionClass: 'staff',
      });
      const { guard: g2, ctx: clinicCtx } = mockContext(clinic);
      expect(() => g2.handleRequest(null, clinic as never, null, clinicCtx)).toThrow(
        UnauthorizedException,
      );

      const patient = new JwtClaimsVO({
        sub: 'pat-1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'patient',
        principalType: 'patient',
        aud: PATIENT_PORTAL_TOKEN_AUDIENCE,
      });
      const { guard: g3, ctx: patientCtx } = mockContext(patient);
      expect(() => g3.handleRequest(null, patient as never, null, patientCtx)).toThrow(
        UnauthorizedException,
      );

      const preauth = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'staff',
        principalType: 'staff',
        aud: PLATFORM_PREAUTH_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });
      const { guard: g4, ctx: preCtx } = mockContext(preauth);
      expect(() => g4.handleRequest(null, preauth as never, null, preCtx)).toThrow(
        UnauthorizedException,
      );

      const platform = platformClaims();
      expect(platform.tenantId).toBeNull();
      const { guard: g6, ctx: ok } = mockContext(platform);
      expect(g6.handleRequest(null, platform as never, null, ok)).toBe(platform);
    });

    it('tenant headers cannot satisfy PlatformAuthRoute without Platform principal', () => {
      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 'tenant-1',
        branchId: 'b1',
        roles: [],
        sessionId: 's',
        sessionClass: 'staff',
      });
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => UsageMeteringPlatformController.prototype.list,
        getClass: () => UsageMeteringPlatformController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: clinic,
            headers: { 'x-tenant-id': 'tenant-1', 'x-branch-id': 'b1' },
          }),
        }),
      } as unknown as ExecutionContext;
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('PlatformPermissionGuard for GET list (usage.view)', () => {
    it('requires Platform session before permission check', async () => {
      const reflector = {
        getAllAndOverride: jest.fn(() => 'usage.view'),
      } as unknown as Reflector;
      const authorization = {
        assertPermission: jest.fn().mockResolvedValue(undefined),
      };
      const guard = new PlatformPermissionGuard(reflector, authorization as never);
      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'staff',
      });
      const ctx = {
        getHandler: () => UsageMeteringPlatformController.prototype.list,
        getClass: () => UsageMeteringPlatformController,
        switchToHttp: () => ({ getRequest: () => ({ user: clinic }) }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(ctx)).rejects.toThrow(UnauthorizedException);
      expect(authorization.assertPermission).not.toHaveBeenCalled();
    });

    it('asserts usage.view for Platform JWT on list', async () => {
      const reflector = {
        getAllAndOverride: jest.fn(() => 'usage.view'),
      } as unknown as Reflector;
      const authorization = {
        assertPermission: jest.fn().mockResolvedValue(undefined),
      };
      const guard = new PlatformPermissionGuard(reflector, authorization as never);
      const platform = new JwtClaimsVO({
        sub: 'pu-1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: '11111111-1111-4111-8111-111111111111',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
      });
      const ctx = {
        getHandler: () => UsageMeteringPlatformController.prototype.list,
        getClass: () => UsageMeteringPlatformController,
        switchToHttp: () => ({ getRequest: () => ({ user: platform }) }),
      } as unknown as ExecutionContext;
      await expect(guard.canActivate(ctx)).resolves.toBe(true);
      expect(authorization.assertPermission).toHaveBeenCalledWith(platform, 'usage.view');
    });
  });

  describe('JwtStrategy access-token validation', () => {
    function buildStrategy(blacklist = false) {
      const jwtService = new JwtService({});
      const tokenService = new JwtTokenService(jwtService, JWT_CFG);
      const sessionCache = {
        isJtiBlacklisted: jest.fn(async () => blacklist),
      };
      return {
        strategy: new JwtStrategy(JWT_CFG, sessionCache as never, tokenService, jwtService, { platformTenant: { findUnique: jest.fn(async () => ({ status: 'ACTIVE' })) } } as never),
        sessionCache,
      };
    }

    it('accepts valid platform access payload with null tenant', async () => {
      const { strategy } = buildStrategy(false);
      const claims = await strategy.validate({
        type: 'access',
        sub: 'pu-1',
        tenantId: null,
        sessionId: '11111111-1111-4111-8111-111111111111',
        sessionClass: 'platform',
        principalType: 'platform',
        aud: PLATFORM_TOKEN_AUDIENCE,
        iss: 'booking-platform',
        jti: 'jti-ok',
      });
      expect(claims.isPlatformSession()).toBe(true);
      expect(claims.tenantId).toBeNull();
    });
  });
});
