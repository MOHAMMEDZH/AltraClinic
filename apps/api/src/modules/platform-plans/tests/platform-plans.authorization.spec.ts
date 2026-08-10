/**
 * Cross-permission isolation for Platform Plans + Step 14 entitlements (in-memory mocks).
 */
import { ForbiddenException } from '@nestjs/common';
import { PlatformPlansService } from '../application/platform-plans.service';
import { PlanEntitlementsService } from '../application/plan-entitlements.service';
import { PlanIdempotencyService } from '../application/plan-idempotency.service';
import { PlatformAssuranceService } from '../../auth/application/services/platform-assurance.service';
import type { JwtClaimsVO } from '../../auth/domain/value-objects/jwt-claims.vo';
import { FakePlanAuditLog } from './support/fake-plan-audit-log';

const CLAIMS = {
  sub: '00000000-0000-4000-8000-000000000077',
  sessionId: '11111111-1111-4111-8111-111111111111',
} as JwtClaimsVO;

function makeService(permissions: string[]) {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => permissions),
  };
  const refreshRepo = {
    findBySessionId: jest.fn(async () => ({ isStepUpFresh: () => true })),
  };
  const prisma = {
    withPlatformBypass: jest.fn(async () => {
      throw new Error('repository must not execute when unauthorized');
    }),
  };
  const assurance = new PlatformAssuranceService({ stepUpSeconds: 300 } as never);
  const idempotency = {
    fingerprint: jest.fn(() => 'hash'),
    beginOrReplay: jest.fn(),
    completeInTransaction: jest.fn(),
    assertValidKey: jest.fn((k: string) => k),
  };
  const entitlements = {
    computeCommercialReadiness: jest.fn(),
  };
  return {
    service: new PlatformPlansService(
      prisma as never,
      authz as never,
      new FakePlanAuditLog(),
      refreshRepo as never,
      assurance,
      idempotency as unknown as PlanIdempotencyService,
      entitlements as unknown as PlanEntitlementsService,
    ),
    prisma,
    authz,
  };
}

function makeEntitlements(permissions: string[]) {
  const authz = {
    resolveEffectivePermissions: jest.fn(async () => permissions),
  };
  const prisma = {
    withPlatformBypass: jest.fn(async () => {
      throw new Error('repository must not execute when unauthorized');
    }),
  };
  const idempotency = {
    fingerprint: jest.fn(() => 'hash'),
    beginOrReplay: jest.fn(),
    completeInTransaction: jest.fn(),
    assertValidKey: jest.fn((k: string) => k),
  };
  return {
    service: new PlanEntitlementsService(
      prisma as never,
      authz as never,
      new FakePlanAuditLog(),
      idempotency as unknown as PlanIdempotencyService,
      {
        enabled: true,
        mutationRateLimitPerMinute: 60,
        highImpactRateLimitPerMinute: 30,
        readHeavyRateLimitPerMinute: 120,
      },
    ),
    prisma,
  };
}

describe('Platform Plans authorization isolation', () => {
  it('plan.view cannot create or publish', async () => {
    const { service, prisma } = makeService(['plan.view', 'plan-version.view']);
    await expect(
      service.createPlan(CLAIMS, {
        canonicalKey: 'plan.x',
        translations: [
          { locale: 'en-US', displayName: 'X', shortDescription: 'x' },
          { locale: 'ar-SY', displayName: 'س', shortDescription: 'س' },
        ],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.publishVersion(CLAIMS, 'p', 'v', { expectedRowVersion: 1, reason: 'nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('plan.edit cannot publish or retire', async () => {
    const { service, prisma } = makeService([
      'plan.view',
      'plan.edit',
      'plan-version.view',
      'plan-version.create',
    ]);
    await expect(
      service.publishVersion(CLAIMS, 'p', 'v', { expectedRowVersion: 1, reason: 'nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.retireVersion(CLAIMS, 'p', 'v', { expectedRowVersion: 1, reason: 'nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('plan.lifecycle cannot edit plan metadata', async () => {
    const { service, prisma } = makeService(['plan.view', 'plan.lifecycle']);
    await expect(
      service.updatePlan(CLAIMS, 'p', { expectedVersion: 1, sortOrder: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('plan.alias.manage cannot publish', async () => {
    const { service, prisma } = makeService(['plan.view', 'plan.alias.manage']);
    await expect(
      service.publishVersion(CLAIMS, 'p', 'v', { expectedRowVersion: 1, reason: 'nope' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('plan-version.publish cannot edit draft metadata', async () => {
    const { service, prisma } = makeService([
      'plan.view',
      'plan-version.view',
      'plan-version.publish',
    ]);
    await expect(
      service.updateDraftVersion(CLAIMS, 'p', 'v', { expectedRowVersion: 1 }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('super_admin role name grants nothing without permissions', async () => {
    const { service, prisma } = makeService([]);
    await expect(service.listPlans(CLAIMS, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('Step 14: plan-entitlement.view cannot mutate; plan-limit.manage cannot replace entitlements', async () => {
    const view = makeEntitlements(['plan-entitlement.view', 'plan-limit.view']);
    await expect(
      view.service.putEntitlements(CLAIMS, 'p', 'v', {
        expectedRowVersion: 1,
        entitlementKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      view.service.putLimits(CLAIMS, 'p', 'v', { expectedRowVersion: 1, limits: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(view.prisma.withPlatformBypass).not.toHaveBeenCalled();

    const limitOnly = makeEntitlements(['plan-limit.manage', 'plan-limit.view']);
    await expect(
      limitOnly.service.putEntitlements(CLAIMS, 'p', 'v', {
        expectedRowVersion: 1,
        entitlementKeys: ['module.dashboard'],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(limitOnly.prisma.withPlatformBypass).not.toHaveBeenCalled();

    const entOnly = makeEntitlements(['plan-entitlement.manage', 'plan-entitlement.view']);
    await expect(
      entOnly.service.putLimits(CLAIMS, 'p', 'v', { expectedRowVersion: 1, limits: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(entOnly.prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('Step 13 plan.edit and plan-version.create do not grant Step 14 entitlement manage', async () => {
    const { service, prisma } = makeEntitlements([
      'plan.edit',
      'plan-version.create',
      'plan-version.view',
    ]);
    await expect(
      service.putEntitlements(CLAIMS, 'p', 'v', {
        expectedRowVersion: 1,
        entitlementKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('Platform Owner has no wildcard; tenant permissions and empty set fail closed', async () => {
    const { permissionsForRoles } = await import(
      '../../auth/platform-rbac/platform-rbac.catalog'
    );
    const ownerPerms = permissionsForRoles(['platform_owner']);
    expect(ownerPerms.some((p) => p === '*' || p.includes('*'))).toBe(false);
    expect(ownerPerms).toContain('plan-entitlement.manage');

    const tenantish = makeEntitlements(['tenant.manage', 'clinic.admin', 'patients.read']);
    await expect(
      tenantish.service.putEntitlements(CLAIMS, 'p', 'v', {
        expectedRowVersion: 1,
        entitlementKeys: [],
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tenantish.prisma.withPlatformBypass).not.toHaveBeenCalled();

    const empty = makeEntitlements([]);
    await expect(
      empty.service.getEntitlements(CLAIMS, 'p', 'v'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(empty.prisma.withPlatformBypass).not.toHaveBeenCalled();
  });

  it('plan-version.review cannot mutate entitlements or Limits', async () => {
    const { service, prisma } = makeEntitlements(['plan-version.review', 'plan-version.view']);
    await expect(
      service.putEntitlements(CLAIMS, 'p', 'v', { expectedRowVersion: 1, entitlementKeys: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.putLimits(CLAIMS, 'p', 'v', { expectedRowVersion: 1, limits: [] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.withPlatformBypass).not.toHaveBeenCalled();
  });
});
