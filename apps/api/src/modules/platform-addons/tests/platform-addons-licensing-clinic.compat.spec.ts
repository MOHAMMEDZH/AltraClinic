/**
 * Step 15 Clinic / licensing compatibility.
 * Modeled on platform-plan-clinic-runtime.compat.spec.ts.
 * Proves LicensingEngineService has no Step 15 table lookup; Clinic JWT rejected on all
 * PlatformAddonsController handlers; publish/approve/revoke do not call licensing.
 */
import { UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { readFileSync } from 'fs';
import { join } from 'path';
import type { ExecutionContext } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformAddonsController } from '../api/platform-addons.controller';

describe('Step 15 Clinic/licensing compatibility', () => {
  it('LicensingEngineService source has no Step 15 table lookup', () => {
    const src = readFileSync(
      join(__dirname, '../../subscription/application/services/licensing-engine.service.ts'),
      'utf8',
    );
    expect(src).not.toMatch(/platformAddOn|platform_addon/i);
    expect(src).not.toMatch(/platformCommercialOverride|platform_commercial_override/i);
    expect(src).not.toMatch(/addonVersionEntitlement|addon_version_entitlement/i);
    expect(src).not.toMatch(/CommercialCompositionService|composeCommercialPreview/);
  });

  it('publish / approve / revoke service sources do not call LicensingEngineService', () => {
    const addonsSrc = readFileSync(
      join(__dirname, '../application/platform-addons.service.ts'),
      'utf8',
    );
    const overridesSrc = readFileSync(
      join(__dirname, '../application/platform-overrides.service.ts'),
      'utf8',
    );
    const compositionSrc = readFileSync(
      join(__dirname, '../application/commercial-composition.service.ts'),
      'utf8',
    );
    for (const src of [addonsSrc, overridesSrc, compositionSrc]) {
      expect(src).not.toMatch(/LicensingEngineService/);
      expect(src).not.toMatch(/resolveLicense/);
      expect(src).not.toMatch(/licenseCache/);
    }
    expect(addonsSrc).toMatch(/async publishVersion/);
    expect(overridesSrc).toMatch(/async approve/);
    expect(overridesSrc).toMatch(/async revoke/);
  });

  it('composition disclaimer never claims tenant-effective runtime access', () => {
    const src = readFileSync(join(__dirname, '../domain/commercial-composition.ts'), 'utf8');
    expect(src).toMatch(/Static commercial definition preview only/);
    expect(src).toMatch(/runtimeEffective:\s*false/);
  });

  it('no Step 16 subscription/tenant assignment mutation APIs in Step 15 services', () => {
    for (const rel of [
      '../application/platform-addons.service.ts',
      '../application/platform-overrides.service.ts',
    ]) {
      const src = readFileSync(join(__dirname, rel), 'utf8');
      expect(src).not.toMatch(/\bassignAddOn\b|\bassignOverride\b/);
      expect(src).not.toMatch(/subscriptionId\s*:/);
      expect(src).not.toMatch(/platformSubscription\.update|tenant\.update.*addon/i);
      // Audit sentinel tenantId is allowed; assignment FKs / writes are not.
      expect(src).not.toMatch(/data:\s*\{[^}]*tenantId\s*:/);
    }
  });

  it('Clinic staff JWT is rejected on every PlatformAddonsController handler', () => {
    const clinic = new JwtClaimsVO({
      sub: 'clinic-user',
      tenantId: 'tenant-clinic',
      branchId: null,
      roles: ['admin'] as never,
      sessionId: 's',
      sessionClass: 'staff',
    });
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformAddonsController)).toBe(true);

    const handlers: Array<keyof PlatformAddonsController> = [
      'listAddOns',
      'createAddOn',
      'getAddOn',
      'updateAddOn',
      'activateAddOn',
      'archiveAddOn',
      'listVersions',
      'compareVersions',
      'createDraftVersion',
      'getVersion',
      'replaceEntitlements',
      'replaceLimitEffects',
      'replaceApplicability',
      'versionReadiness',
      'publishVersion',
      'retireVersion',
      'cloneVersion',
      'listOverrides',
      'createOverride',
      'compareOverrides',
      'getOverride',
      'updateOverride',
      'overrideReadiness',
      'submitOverride',
      'approveOverride',
      'rejectOverride',
      'revokeOverride',
      'supersedeOverride',
      'compositionPreview',
    ];

    for (const handler of handlers) {
      const reflector = {
        getAllAndOverride: jest.fn((key: string) => {
          if (key === 'isPlatformAuthRoute') return true;
          return undefined;
        }),
      } as unknown as Reflector;
      const guard = new JwtAuthGuard(reflector);
      const ctx = {
        getHandler: () => PlatformAddonsController.prototype[handler],
        getClass: () => PlatformAddonsController,
        switchToHttp: () => ({ getRequest: () => ({ user: clinic }) }),
      } as unknown as ExecutionContext;
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    }
  });
});
