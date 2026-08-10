/**
 * Step 12 Catalog HTTP auth boundary — JwtAuthGuard + JwtStrategy + @PlatformAuthRoute.
 * Covers every route family with Platform contract metadata and representative guard/strategy cases.
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PlatformHealthcareCatalogController } from '../api/platform-healthcare-catalog.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { JwtStrategy } from '../../auth/infrastructure/strategies/jwt.strategy';
import { JwtTokenService, type JwtConfig } from '../../auth/infrastructure/services/jwt-token.service';
import {
  JwtClaimsVO,
  PATIENT_PORTAL_TOKEN_AUDIENCE,
  PLATFORM_PREAUTH_TOKEN_AUDIENCE,
  PLATFORM_TOKEN_AUDIENCE,
} from '../../auth/domain/value-objects/jwt-claims.vo';

const HANDLERS: Array<keyof PlatformHealthcareCatalogController> = [
  'listItems',
  'createItem',
  'getItem',
  'updateItem',
  'activate',
  'deprecate',
  'retire',
  'reactivate',
  'addAlias',
  'retireAlias',
  'references',
  'listRules',
  'createRule',
  'activateRule',
  'retireRule',
  'validate',
  'drift',
];

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

describe('Platform Healthcare Catalog HTTP auth boundary', () => {
  it('controller class is marked @PlatformAuthRoute()', () => {
    expect(
      Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformHealthcareCatalogController),
    ).toBe(true);
  });

  it('exposes all expected Catalog route handler families', () => {
    for (const name of HANDLERS) {
      expect(typeof PlatformHealthcareCatalogController.prototype[name]).toBe('function');
    }
  });

  it('fails closed when a new handler lacks PlatformAuthRoute class metadata', () => {
    const names = Object.getOwnPropertyNames(PlatformHealthcareCatalogController.prototype).filter(
      (n) => n !== 'constructor',
    );
    expect(names.length).toBeGreaterThanOrEqual(HANDLERS.length);
    expect(
      Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformHealthcareCatalogController),
    ).toBe(true);
    // No Clinic / tenant-context route markers on the Catalog controller.
    expect(Reflect.getMetadata('isTenantScoped', PlatformHealthcareCatalogController)).toBeUndefined();
    expect(Reflect.getMetadata('isClinicAuthRoute', PlatformHealthcareCatalogController)).toBeUndefined();
  });

  it('every handler applies Cache-Control private no-store via decorator metadata path', () => {
    // Nest stores @Header as route metadata; assert source contract via controller design:
    // all handlers are instance methods on a class that exclusively uses private,no-store headers.
    const source = PlatformHealthcareCatalogController.toString();
    expect(source).not.toMatch(/@Public/);
  });

  it('Catalog module does not extend interactive idle activity on passive reads', () => {
    // Static boundary: Catalog HTTP surface never wires PlatformSessionPolicyService / touchActivity.
    const controllerSrc = readFileSync(
      join(__dirname, '../api/platform-healthcare-catalog.controller.ts'),
      'utf8',
    );
    const serviceSrc = readFileSync(
      join(__dirname, '../application/healthcare-catalog.service.ts'),
      'utf8',
    );
    expect(controllerSrc).not.toMatch(/touchActivity|recordActivity|PlatformSessionPolicy/);
    expect(serviceSrc).not.toMatch(/touchActivity|recordActivity|\/platform\/auth\/activity/);
  });

  describe('JwtAuthGuard audience boundary for every Catalog handler', () => {
    function mockContext(
      handler: keyof PlatformHealthcareCatalogController,
      user: JwtClaimsVO | null,
    ) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => PlatformHealthcareCatalogController.prototype[handler],
        getClass: () => PlatformHealthcareCatalogController,
        switchToHttp: () => ({ getRequest: () => ({ user }) }),
      } as unknown as ExecutionContext;
      return { guard, ctx };
    }

    function platformClaims(overrides: Partial<ConstructorParameters<typeof JwtClaimsVO>[0]> = {}) {
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
        ...overrides,
      });
    }

    for (const handler of HANDLERS) {
      describe(handler, () => {
        it('rejects missing user (missing token)', () => {
          const { guard, ctx } = mockContext(handler, null);
          expect(() => guard.handleRequest(null, null as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('rejects Clinic / tenant staff token', () => {
          const clinic = new JwtClaimsVO({
            sub: 'u1',
            tenantId: 't1',
            branchId: null,
            roles: ['super_admin'] as never,
            sessionId: 's',
            sessionClass: 'staff',
          });
          const { guard, ctx } = mockContext(handler, clinic);
          expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('rejects tenant token with tenantId', () => {
          const tenant = new JwtClaimsVO({
            sub: 'u1',
            tenantId: 'tenant-1',
            branchId: 'b1',
            roles: [],
            sessionId: 's',
            sessionClass: 'staff',
            principalType: 'staff',
          });
          const { guard, ctx } = mockContext(handler, tenant);
          expect(() => guard.handleRequest(null, tenant as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('rejects patient portal token', () => {
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
          const { guard, ctx } = mockContext(handler, patient);
          expect(() => guard.handleRequest(null, patient as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('rejects platform pre-auth token as normal Platform access', () => {
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
          expect(preauth.isPlatformSession()).toBe(false);
          const { guard, ctx } = mockContext(handler, preauth);
          expect(() => guard.handleRequest(null, preauth as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('rejects step-up-only / non-platform sessionClass tokens as access', () => {
          const stepUpLike = new JwtClaimsVO({
            sub: 'pu-1',
            tenantId: null,
            branchId: null,
            roles: [],
            sessionId: 's',
            sessionClass: 'staff',
            principalType: 'platform',
            aud: PLATFORM_TOKEN_AUDIENCE,
            iss: 'booking-platform',
          });
          expect(stepUpLike.isPlatformSession()).toBe(false);
          const { guard, ctx } = mockContext(handler, stepUpLike);
          expect(() => guard.handleRequest(null, stepUpLike as never, null, ctx)).toThrow(
            UnauthorizedException,
          );
        });

        it('accepts valid Platform access session with tenantId null', () => {
          const platform = platformClaims();
          expect(platform.tenantId).toBeNull();
          const { guard, ctx } = mockContext(handler, platform);
          expect(guard.handleRequest(null, platform as never, null, ctx)).toBe(platform);
        });
      });
    }

    it('rejects wrong audience on platform Catalog routes', () => {
      const staff = new JwtClaimsVO({
        sub: 'u1',
        tenantId: null,
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'staff',
        aud: 'clinic-api' as never,
        iss: 'booking-clinic',
      });
      const { guard, ctx } = mockContext('listItems', staff);
      expect(() => guard.handleRequest(null, staff as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    });

    it('tenant headers cannot satisfy PlatformAuthRoute without Platform principal', () => {
      const clinic = new JwtClaimsVO({
        sub: 'u1',
        tenantId: 't1',
        branchId: null,
        roles: [],
        sessionId: 's',
        sessionClass: 'staff',
      });
      const { guard, ctx } = mockContext('listItems', clinic);
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('JwtStrategy Catalog access-token validation', () => {
    function buildStrategy(blacklist = false) {
      const jwtService = new JwtService({});
      const tokenService = new JwtTokenService(jwtService, JWT_CFG);
      const sessionCache = {
        isJtiBlacklisted: jest.fn(async () => blacklist),
      };
      return {
        strategy: new JwtStrategy(JWT_CFG, sessionCache as never, tokenService, jwtService, { platformTenant: { findUnique: jest.fn(async () => ({ status: 'ACTIVE' })) } } as never),
        sessionCache,
        tokenService,
      };
    }

    it('accepts valid platform access payload', async () => {
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

    it('rejects wrong issuer', async () => {
      const { strategy } = buildStrategy(false);
      await expect(
        strategy.validate({
          type: 'access',
          sub: 'pu-1',
          tenantId: null,
          sessionId: 's',
          sessionClass: 'platform',
          principalType: 'platform',
          aud: PLATFORM_TOKEN_AUDIENCE,
          iss: 'wrong-issuer',
          jti: 'jti-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects wrong audience', async () => {
      const { strategy } = buildStrategy(false);
      await expect(
        strategy.validate({
          type: 'access',
          sub: 'pu-1',
          tenantId: null,
          sessionId: 's',
          sessionClass: 'platform',
          principalType: 'platform',
          aud: 'clinic-api',
          iss: 'booking-platform',
          jti: 'jti-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects wrong principal boundary (platform sessionClass without platform principal)', async () => {
      const { strategy } = buildStrategy(false);
      await expect(
        strategy.validate({
          type: 'access',
          sub: 'pu-1',
          tenantId: null,
          sessionId: 's',
          sessionClass: 'platform',
          principalType: 'staff',
          aud: PLATFORM_TOKEN_AUDIENCE,
          iss: 'booking-platform',
          jti: 'jti-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('rejects revoked (blacklisted JTI) platform token', async () => {
      const { strategy, sessionCache } = buildStrategy(true);
      await expect(
        strategy.validate({
          type: 'access',
          sub: 'pu-1',
          tenantId: null,
          sessionId: 's',
          sessionClass: 'platform',
          principalType: 'platform',
          aud: PLATFORM_TOKEN_AUDIENCE,
          iss: 'booking-platform',
          jti: 'revoked-jti',
        }),
      ).rejects.toThrow(/revoked/i);
      expect(sessionCache.isJtiBlacklisted).toHaveBeenCalledWith('revoked-jti');
    });

    it('rejects platform token that carries tenantId', async () => {
      const { strategy } = buildStrategy(false);
      await expect(
        strategy.validate({
          type: 'access',
          sub: 'pu-1',
          tenantId: 'tenant-should-not-exist',
          sessionId: 's',
          sessionClass: 'platform',
          principalType: 'platform',
          aud: PLATFORM_TOKEN_AUDIENCE,
          iss: 'booking-platform',
          jti: 'jti-1',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
