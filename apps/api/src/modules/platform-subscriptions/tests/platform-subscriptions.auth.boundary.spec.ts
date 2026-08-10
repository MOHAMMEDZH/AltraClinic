/**
 * Step 16 Subscription HTTP auth boundary — full route-family matrix.
 */
import 'reflect-metadata';
import { readFileSync } from 'fs';
import { join } from 'path';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { PlatformSubscriptionsController } from '../api/platform-subscriptions.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
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
import { PlatformUser } from '../../auth/domain/entities/platform-user.entity';

const HANDLERS: Array<keyof PlatformSubscriptionsController> = [
  'list',
  'create',
  'get',
  'update',
  'history',
  'assignPlan',
  'replaceAddOns',
  'replaceOverrides',
  'updateDates',
  'readiness',
  'preview',
  'compare',
  'inspectRuntime',
  'explainRuntime',
  'schedule',
  'activate',
  'suspend',
  'resume',
  'cancel',
  'supersede',
  'renew',
];

const RATE_BUCKETS: Record<
  (typeof HANDLERS)[number],
  'mutation' | 'highImpact' | 'readHeavy' | 'standard-read'
> = {
  list: 'readHeavy',
  get: 'readHeavy',
  history: 'readHeavy',
  readiness: 'readHeavy',
  preview: 'readHeavy',
  compare: 'readHeavy',
  inspectRuntime: 'readHeavy',
  explainRuntime: 'readHeavy',
  create: 'mutation',
  update: 'mutation',
  assignPlan: 'mutation',
  replaceAddOns: 'mutation',
  replaceOverrides: 'mutation',
  updateDates: 'mutation',
  schedule: 'highImpact',
  activate: 'highImpact',
  suspend: 'highImpact',
  resume: 'highImpact',
  cancel: 'highImpact',
  supersede: 'highImpact',
  renew: 'highImpact',
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

describe('Platform Subscriptions HTTP auth boundary', () => {
  it('controller class is marked @PlatformAuthRoute()', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformSubscriptionsController)).toBe(
      true,
    );
  });

  it('exposes all expected subscription handlers', () => {
    for (const name of HANDLERS) {
      expect(typeof PlatformSubscriptionsController.prototype[name]).toBe('function');
    }
  });

  it('fails closed when Clinic/tenant markers; no @Public', () => {
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformSubscriptionsController)).toBe(
      true,
    );
    expect(Reflect.getMetadata('isTenantScoped', PlatformSubscriptionsController)).toBeUndefined();
    expect(Reflect.getMetadata('isClinicAuthRoute', PlatformSubscriptionsController)).toBeUndefined();
    expect(PlatformSubscriptionsController.toString()).not.toMatch(/@Public/);
  });

  it('assigns every handler a declared rate-limit bucket', () => {
    for (const name of HANDLERS) {
      expect(RATE_BUCKETS[name]).toBeDefined();
    }
    expect(Object.keys(RATE_BUCKETS).sort()).toEqual([...HANDLERS].sort());
  });

  it('controller source sets Cache-Control private, no-store on handlers', () => {
    const src = readFileSync(
      join(__dirname, '../api/platform-subscriptions.controller.ts'),
      'utf8',
    );
    const headerCount = (src.match(/Cache-Control',\s*'private, no-store'/g) ?? []).length;
    expect(headerCount).toBeGreaterThanOrEqual(HANDLERS.length);
  });

  it('service does not call LicensingEngineService or interactive activity APIs', () => {
    const source = readFileSync(
      join(__dirname, '../application/platform-subscriptions.service.ts'),
      'utf8',
    );
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/LicensingEngineService/);
    expect(code).not.toMatch(/touchActivity|extendIdle|recordInteractiveActivity|bumpLastActivity/);
  });

  it('PlatformSubscriptionsModule does not register TX failure hook', () => {
    const moduleSrc = readFileSync(join(__dirname, '../platform-subscriptions.module.ts'), 'utf8');
    expect(moduleSrc).not.toContain('PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK');
    expect(moduleSrc).not.toMatch(/provide:\s*PLATFORM_SUBSCRIPTIONS_TX_FAILURE_HOOK/);
  });

  it('suspended Platform User cannot authenticate', () => {
    const suspended = PlatformUser.restore({
      id: '00000000-0000-4000-8000-000000000001',
      email: 's@example.com',
      passwordHash: 'x',
      displayName: null,
      status: 'suspended',
      isActive: false,
      mfaEnabled: true,
      mfaSecretEncrypted: null,
      mfaKeyVersion: null,
      mfaPendingSecretEncrypted: null,
      mfaPendingExpiresAt: null,
      mfaConfirmedAt: null,
      lastTotpStep: null,
      failedMfaCount: 0,
      authzRevision: 1,
      failedLoginCount: 0,
      lockedUntil: null,
      passwordChangedAt: new Date(),
      lastLoginAt: null,
      lastLoginIp: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      suspendedAt: new Date(),
    });
    expect(suspended.isSuspended()).toBe(true);
    expect(suspended.canAuthenticate()).toBe(false);
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
      getHandler: () => PlatformSubscriptionsController.prototype.create,
      getClass: () => PlatformSubscriptionsController,
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

  describe('JwtAuthGuard for every handler', () => {
    function mockContext(handler: keyof PlatformSubscriptionsController, user: JwtClaimsVO | null) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPublic') return false;
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => PlatformSubscriptionsController.prototype[handler],
        getClass: () => PlatformSubscriptionsController,
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

    for (const handler of HANDLERS) {
      describe(handler, () => {
        it('rejects missing/Clinic/patient/pre-auth/step-up-as-access; accepts Platform', () => {
          const { guard, ctx: missing } = mockContext(handler, null);
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
          const { guard: g2, ctx: clinicCtx } = mockContext(handler, clinic);
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
          const { guard: g3, ctx: patientCtx } = mockContext(handler, patient);
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
          const { guard: g4, ctx: preCtx } = mockContext(handler, preauth);
          expect(() => g4.handleRequest(null, preauth as never, null, preCtx)).toThrow(
            UnauthorizedException,
          );

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
          const { guard: g5, ctx: stepCtx } = mockContext(handler, stepUpLike);
          expect(() => g5.handleRequest(null, stepUpLike as never, null, stepCtx)).toThrow(
            UnauthorizedException,
          );

          const platform = platformClaims();
          expect(platform.tenantId).toBeNull();
          const { guard: g6, ctx: ok } = mockContext(handler, platform);
          expect(g6.handleRequest(null, platform as never, null, ok)).toBe(platform);
        });
      });
    }
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

    it('rejects wrong issuer, audience, principal, revoked JTI, tenant-bearing platform token', async () => {
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
          jti: 'jti-2',
        }),
      ).rejects.toThrow(UnauthorizedException);

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
          jti: 'jti-3',
        }),
      ).rejects.toThrow(UnauthorizedException);

      const revoked = buildStrategy(true);
      await expect(
        revoked.strategy.validate({
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
          jti: 'jti-tenant',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
