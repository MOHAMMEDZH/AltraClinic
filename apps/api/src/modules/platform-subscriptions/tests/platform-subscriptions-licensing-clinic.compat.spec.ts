/**
 * Step 16 Clinic / licensing compatibility (preserved under Step 17 coexistence).
 * LicensingEngineService must not query commercial tables directly (Step 17 uses
 * EffectiveEntitlementRuntimeService). PlatformSubscriptionsService must not call
 * LicensingEngineService. Clinic JWT rejected on all handlers.
 */
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformSubscriptionsController } from '../api/platform-subscriptions.controller';

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

describe('Step 16 Clinic/licensing compatibility', () => {
  it('LicensingEngineService source has no direct Step 16 commercial table lookup', () => {
    const src = readFileSync(
      join(__dirname, '../../subscription/application/services/licensing-engine.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/platformSubscriptionCommercial|platform_subscription_commercial/i);
    expect(src).not.toMatch(/SubscriptionCommercialConfig|commercialFingerprint/i);
    expect(src).not.toMatch(/CommercialCompositionService|composeCommercialPreview/);
    expect(src).not.toMatch(/PlatformSubscriptionsService/);
    // Step 17 coexistence projects via EffectiveEntitlementRuntimeService only.
    expect(src).toMatch(/EffectiveEntitlementRuntimeService/);
  });

  it('PlatformSubscriptionsService source does not call LicensingEngineService', () => {
    const src = readFileSync(
      join(__dirname, '../application/platform-subscriptions.service.ts'),
      'utf8',
    );
    const code = src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    expect(code).not.toMatch(/LicensingEngineService/);
    expect(code).not.toMatch(/resolveLicense\(/);
    expect(code).not.toMatch(/licenseCache/);
    expect(src).toMatch(/RUNTIME_EFFECTIVE/);
    expect(src).toMatch(/Never mutates PlatformSubscription runtime plan/);
  });

  it('lifecycle disclaimer on commercial config remains configuration-scoped', () => {
    const src = readFileSync(
      join(__dirname, '../domain/subscription-commercial-lifecycle.ts'),
      'utf8',
    );
    expect(src).toMatch(/Commercial subscription configuration only/);
    expect(src).toMatch(/runtime access remains unchanged/);
  });

  it('Clinic staff JWT is rejected on every PlatformSubscriptionsController handler', () => {
    const clinic = new JwtClaimsVO({
      sub: 'clinic-user',
      tenantId: 'tenant-clinic',
      branchId: null,
      roles: ['admin'] as never,
      sessionId: 's',
      sessionClass: 'staff',
    });
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformSubscriptionsController)).toBe(
      true,
    );

    for (const handler of HANDLERS) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => PlatformSubscriptionsController.prototype[handler],
        getClass: () => PlatformSubscriptionsController,
        switchToHttp: () => ({ getRequest: () => ({ user: clinic }) }),
      } as unknown as ExecutionContext;
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    }
  });
});
