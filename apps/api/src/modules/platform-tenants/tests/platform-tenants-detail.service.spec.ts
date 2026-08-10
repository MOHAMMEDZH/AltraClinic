import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PlatformTenantsDetailService } from '../application/platform-tenants-detail.service';
import type { PlatformTenantsConfig } from '../config/platform-tenants.config';
import { FakePlatformTenantsAuditLog } from './support/fake-platform-tenants-audit-log';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';

const CONFIG: PlatformTenantsConfig = {
  defaultPageSize: 25,
  maxPageSize: 100,
  maxSearchLength: 64,
  maxSubscriptionHistory: 2,
  maxAccessSummaryItems: 200,
  directoryRateLimitPerMinute: 60,
};

const CLAIMS = { sub: 'pu-1', sessionId: 'sess-1' } as JwtClaimsVO;

const ROW = {
  id: 'pt-1',
  tenantId: 't-1',
  displayName: 'Alpha Clinic',
  region: 'ME_SOUTH',
  plan: 'LITE',
  status: 'ACTIVE',
  trialEndsAt: null,
  activatedAt: new Date('2026-01-01'),
  suspendedAt: null,
  archivedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
  tenant: {
    id: 't-1',
    name: 'Alpha',
    slug: 'alpha',
    features: { clinicProfile: { clinicType: 'medical' } },
  },
  platformSubscriptions: [
    {
      id: 'sub-1',
      status: 'ACTIVE',
      plan: 'LITE',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      createdAt: new Date('2026-01-01'),
    },
    {
      id: 'sub-0',
      status: 'TRIAL',
      plan: 'LITE',
      startDate: new Date('2025-12-01'),
      endDate: new Date('2026-01-01'),
      createdAt: new Date('2025-12-01'),
    },
  ],
};

function makeService(opts: { permissions?: string[]; row?: typeof ROW | null; licenseError?: boolean }) {
  const audit = new FakePlatformTenantsAuditLog();
  const prisma = {
    withPlatformBypass: jest.fn(async (fn: (c: unknown) => Promise<unknown>) =>
      fn({
        platformTenant: {
          findUnique: jest.fn(async () => (opts.row === undefined ? ROW : opts.row)),
        },
      }),
    ),
  };
  const authz = {
    resolveEffectivePermissions: jest.fn(async () =>
      opts.permissions ?? ['tenant.view', 'plan.view', 'subscription.view'],
    ),
  };
  const licensing = {
    resolveLicense: opts.licenseError
      ? jest.fn(async () => {
          throw new Error('boom');
        })
      : jest.fn(async () => ({
          licenseId: 'lic',
          tenantId: 't-1',
          platformTenantId: 'pt-1',
          displayName: 'Alpha Clinic',
          uiPlan: 'starter',
          backendPlan: 'lite',
          platformPlan: 'starter',
          status: 'active',
          subscriptionStatus: 'active',
          platformStatus: 'active',
          billingCycle: 'monthly',
          startDate: null,
          endDate: null,
          renewalDate: null,
          trialEndsAt: null,
          contractEndDate: null,
          gracePeriodEndsAt: null,
          autoRenew: false,
          readOnly: false,
          limits: {},
          effectiveLimits: { maxUsers: 5 },
          grants: { usersBonus: 0, storageGbBonus: 0, aiCreditsBonus: 0 },
          features: {},
          modules: {},
          backendFeatures: {},
          grantHistory: [],
          version: 1,
        })),
  };
  const service = new PlatformTenantsDetailService(
    prisma as never,
    authz as never,
    licensing as never,
    CONFIG,
    audit,
  );
  return { service, audit, licensing };
}

describe('PlatformTenantsDetailService', () => {
  it('returns 404 for unknown tenant', async () => {
    const { service } = makeService({ row: null });
    await expect(service.getDetail(CLAIMS, 'missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('marks contacts/planVersion/addons/overrides/sales unavailable', async () => {
    const { service } = makeService({});
    const detail = await service.getDetail(CLAIMS, 'pt-1');
    expect(detail.contacts.availability).toBe('unavailable');
    expect(detail.commercial.planVersion.availability).toBe('unavailable');
    expect(detail.commercial.addons.availability).toBe('unavailable');
    expect(detail.commercial.overrides.availability).toBe('unavailable');
    expect(detail.sales.availability).toBe('unavailable');
    expect(detail.facilityProfile.specialties.availability).toBe('unavailable');
  });

  it('bounds subscription history to config max', async () => {
    const { service } = makeService({});
    const detail = await service.getDetail(CLAIMS, 'pt-1');
    expect(detail.commercial.subscription.history?.length).toBeLessThanOrEqual(CONFIG.maxSubscriptionHistory);
  });

  it('audits detail view with real tenant id', async () => {
    const { service, audit } = makeService({});
    await service.getDetail(CLAIMS, 'pt-1');
    expect(audit.records[0].tenantId).toBe('t-1');
    expect(audit.records[0].action).toBe('platform_tenants.detail.viewed');
  });

  it('resolves access via licensing engine when entitlement.view is present', async () => {
    const { service, licensing } = makeService({
      permissions: ['tenant.view', 'plan.view', 'subscription.view', 'entitlement.view'],
    });
    await service.getDetail(CLAIMS, 'pt-1');
    expect(licensing.resolveLicense).toHaveBeenCalledWith('t-1');
  });

  it('does not call licensing without entitlement.view on detail', async () => {
    const { service, licensing } = makeService({
      permissions: ['tenant.view', 'plan.view', 'subscription.view'],
    });
    const detail = await service.getDetail(CLAIMS, 'pt-1');
    expect(licensing.resolveLicense).not.toHaveBeenCalled();
    expect(detail.access).toMatchObject({
      id: 'access',
      availability: 'permission_limited',
      reasonCode: 'missing_entitlement_view',
    });
  });

  it('returns Prisma enum strings in identity and commercial sections', async () => {
    const { service } = makeService({});
    const detail = await service.getDetail(CLAIMS, 'pt-1');
    expect(detail.identity.status).toBe('ACTIVE');
    expect(detail.identity.region).toBe('ME_SOUTH');
    expect(detail.commercial.legacyPlan).toMatchObject({ plan: 'LITE' });
    expect(detail.commercial.subscription.history?.[0]).toMatchObject({
      status: 'ACTIVE',
      plan: 'LITE',
    });
  });

  it('marks operations unavailable when operations.view is present', async () => {
    const { service } = makeService({
      permissions: ['tenant.view', 'plan.view', 'subscription.view', 'operations.view'],
    });
    const detail = await service.getDetail(CLAIMS, 'pt-1');
    expect(detail.operations).toMatchObject({
      availability: 'unavailable',
      reasonCode: 'operations_console_deferred',
    });
  });

  it('requires entitlement.view for access summary', async () => {
    const { service, licensing } = makeService({
      permissions: ['tenant.view'],
    });
    await expect(service.getAccessSummary(CLAIMS, 'pt-1')).rejects.toBeInstanceOf(ForbiddenException);
    expect(licensing.resolveLicense).not.toHaveBeenCalled();
  });

  it('loads access summary when entitlement.view is present', async () => {
    const { service, licensing } = makeService({
      permissions: ['tenant.view', 'entitlement.view'],
    });
    const summary = await service.getAccessSummary(CLAIMS, 'pt-1');
    expect(licensing.resolveLicense).toHaveBeenCalledWith('t-1');
    expect(summary).toMatchObject({ availability: 'available' });
  });
});
