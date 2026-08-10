/**
 * Focused Clinic / runtime compatibility after LicensingEngineService sentinel guard (Option B).
 * Proves normal tenants unchanged; sentinel fails closed; no Step 14 table lookup at runtime.
 */
import { NotFoundException } from '@nestjs/common';
import { readFileSync } from 'fs';
import { join } from 'path';
import { LicensingEngineService } from '../../subscription/application/services/licensing-engine.service';
import {
  isPlatformAuditSentinelTenantId,
  PLATFORM_AUDIT_SENTINEL_TENANT_ID,
} from '../../platform-tenants/platform-tenants.tokens';
import { PlatformPlansController } from '../api/platform-plans.controller';
import { IS_PLATFORM_AUTH_ROUTE_KEY } from '../../auth/api/decorators/platform-auth-route.decorator';
import { JwtAuthGuard } from '../../auth/api/guards/jwt-auth.guard';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { PlatformTenant } from '../../platform-admin/domain/entities/platform-tenant.entity';
import { PlatformAdminValidationError } from '../../platform-admin/domain/exceptions/platform-admin.exception';

describe('Step 14 Clinic/runtime compatibility (licensing sentinel Option B)', () => {
  it('LicensingEngineService source retains sentinel fail-closed and has no Step 14 table lookup', () => {
    const src = readFileSync(
      join(__dirname, '../../subscription/application/services/licensing-engine.service.ts'),
      'utf8',
    );
    expect(src).toContain('isPlatformAuditSentinelTenantId');
    expect(src).toContain('platform_audit_sentinel_license_rejected');
    expect(src).not.toMatch(/platformPlanVersionEntitlement|platform_plan_version_entitlement/i);
    expect(src).not.toMatch(/platformPlanVersionLimit|commercialDefinitionOwnership/);
  });

  it('authoritative sentinel helpers have a single reserved-id source (no duplicated magic UUID literals)', () => {
    const tokensSrc = readFileSync(
      join(__dirname, '../../platform-tenants/platform-tenants.tokens.ts'),
      'utf8',
    );
    const matches = tokensSrc.match(/00000000-0000-4000-8000-000000000047/g) ?? [];
    expect(matches.length).toBe(1);
    expect(isPlatformAuditSentinelTenantId(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).toBe(true);
    expect(isPlatformAuditSentinelTenantId('11111111-1111-4111-8111-111111111111')).toBe(false);
    // Similar-looking UUID must not trigger sentinel handling.
    expect(isPlatformAuditSentinelTenantId('00000000-0000-4000-8000-000000000048')).toBe(false);
    expect(isPlatformAuditSentinelTenantId('00000000-0000-4000-8000-000000000046')).toBe(false);
  });

  it('sentinel tenantId rejects before cache write; arbitrary UUID follows normal resolve path', async () => {
    const engine = Object.create(LicensingEngineService.prototype) as {
      resolveLicense: (tenantId: string) => Promise<unknown>;
      licenseCache: Map<string, unknown>;
      loadTenantContext: jest.Mock;
      buildLicense: jest.Mock;
      lifecycleState: { syncFromResolvedLicense: jest.Mock };
      logger: { warn: jest.Mock };
    };
    engine.licenseCache = new Map();
    engine.loadTenantContext = jest.fn(async () => ({ tenantId: 't1' }));
    engine.buildLicense = jest.fn(() => ({ uiPlan: 'lite', status: 'active' }));
    engine.lifecycleState = { syncFromResolvedLicense: jest.fn(async () => undefined) };
    engine.logger = { warn: jest.fn() };

    await expect(engine.resolveLicense(PLATFORM_AUDIT_SENTINEL_TENANT_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(engine.licenseCache.size).toBe(0);
    expect(engine.loadTenantContext).not.toHaveBeenCalled();
    expect(engine.logger.warn).toHaveBeenCalledWith('platform_audit_sentinel_license_rejected');

    const arbitrary = '11111111-1111-4111-8111-111111111111';
    const license = await engine.resolveLicense(arbitrary);
    expect(license).toMatchObject({ uiPlan: 'lite' });
    expect(engine.loadTenantContext).toHaveBeenCalledTimes(1);

    const similar = '00000000-0000-4000-8000-000000000048';
    await engine.resolveLicense(similar);
    expect(engine.loadTenantContext).toHaveBeenCalledWith(similar);
  });

  it('tenant provision rejects reserved sentinel identity (collision prevention)', () => {
    expect(() =>
      PlatformTenant.provision({
        tenantId: PLATFORM_AUDIT_SENTINEL_TENANT_ID,
        displayName: 'Collision Attempt',
        region: 'me-central',
        plan: 'starter',
        provisionedBy: 'admin-1',
      }),
    ).toThrow(PlatformAdminValidationError);
  });

  it('Clinic staff JWT is rejected on every Step 14 Platform Plans handler', () => {
    const clinic = new JwtClaimsVO({
      sub: 'clinic-user',
      tenantId: 'tenant-clinic',
      branchId: null,
      roles: ['admin'] as never,
      sessionId: 's',
      sessionClass: 'staff',
    });
    expect(Reflect.getMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, PlatformPlansController)).toBe(true);
    const handlers: Array<keyof PlatformPlansController> = [
      'getEntitlements',
      'putEntitlements',
      'applyRequired',
      'getLimits',
      'putLimits',
      'entitlementPreview',
      'readiness',
      'compare',
      'clone',
      'publish',
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
        getHandler: () => PlatformPlansController.prototype[handler],
        getClass: () => PlatformPlansController,
        switchToHttp: () => ({ getRequest: () => ({ user: clinic }) }),
      } as unknown as ExecutionContext;
      expect(() => guard.handleRequest(null, clinic as never, null, ctx)).toThrow(
        UnauthorizedException,
      );
    }
  });
});
