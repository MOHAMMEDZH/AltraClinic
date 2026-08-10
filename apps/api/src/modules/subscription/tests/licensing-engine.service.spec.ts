import { ForbiddenException } from '@nestjs/common';
import { LicensingEngineService } from '../application/services/licensing-engine.service';
import { LicensingAuditService } from '../application/services/licensing-audit.service';
import { LicensingLifecycleStateService } from '../application/services/licensing-lifecycle-state.service';
import { PLAN_LIMITS, UNLIMITED } from '../domain/config/plan-limits.config';
import { PlanLimitExceededException } from '../domain/exceptions/plan-limit-exceeded.exception';

const TENANT = 'tenant-lic-001';

function makePlatformTenant(plan: 'LITE' | 'PRO' | 'ENTERPRISE', uiPlan?: string) {
  return {
    id: 'pt-1',
    tenantId: TENANT,
    displayName: 'Test Clinic',
    plan,
    status: 'ACTIVE',
    trialEndsAt: null,
    contractEndDate: new Date(Date.now() + 86_400_000 * 30),
    contractStartDate: new Date(),
    suspendedAt: null,
    platformSubscriptions: [
      {
        id: 'sub-1',
        plan,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: null,
        autoRenew: true,
        billingCycleMonths: 1,
      },
    ],
  };
}

function makePrisma(
  platformTenant: ReturnType<typeof makePlatformTenant> | null,
  features: Record<string, unknown> = {},
  uiPlan?: string,
) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue({
        id: TENANT,
        name: 'Test Clinic',
        features: { ...(uiPlan ? { subscriptionUiPlan: uiPlan } : {}), ...features },
        trialEndsAt: null,
      }),
    },
    platformTenant: {
      findUnique: jest.fn().mockResolvedValue(platformTenant),
    },
    user: { count: jest.fn().mockResolvedValue(0) },
    branch: { count: jest.fn().mockResolvedValue(0) },
    patient: { count: jest.fn().mockResolvedValue(0) },
    appointment: { count: jest.fn().mockResolvedValue(0) },
    analyticsReportRecord: { count: jest.fn().mockResolvedValue(0) },
    operationalReportRecord: { count: jest.fn().mockResolvedValue(0) },
    notification: { count: jest.fn().mockResolvedValue(0) },
    aiUsageDaily: { aggregate: jest.fn().mockResolvedValue({ _sum: { messageCount: 0 } }) },
    mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
  };
}

function makeTenantSubscriptionService(prisma: ReturnType<typeof makePrisma>) {
  return {
    getUsage: jest.fn().mockResolvedValue({
      users: 0,
      branches: 0,
      patients: 0,
      appointmentsThisMonth: 0,
      reportsThisMonth: 0,
      apiCallsToday: 0,
      storageGb: 0,
      smsThisMonth: 0,
      whatsappThisMonth: 0,
      emailThisMonth: 0,
    }),
    resolveRequestedPlan: jest.fn((plan: string) => ({
      backendPlan: plan === 'business' ? 'pro' : plan === 'starter' ? 'lite' : plan,
      platformPlan: 'growth',
      uiPlan: plan,
    })),
  };
}

function makeAuditDeps() {
  const audit = {
    recordLicenseEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingAuditService;
  const lifecycleState = {
    syncFromResolvedLicense: jest.fn().mockResolvedValue(undefined),
    persistKnownStatus: jest.fn().mockResolvedValue(undefined),
  } as unknown as LicensingLifecycleStateService;
  return { audit, lifecycleState };
}

function makeEngine(
  prisma: ReturnType<typeof makePrisma>,
  tenantSub: ReturnType<typeof makeTenantSubscriptionService>,
) {
  const { audit, lifecycleState } = makeAuditDeps();
  return new LicensingEngineService(prisma as never, tenantSub as never, audit, lifecycleState);
}

describe('LicensingEngineService', () => {
  it('resolves starter/lite license from platform tenant', async () => {
    const prisma = makePrisma(makePlatformTenant('LITE'));
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const license = await svc.resolveLicense(TENANT);
    expect(license.uiPlan).toBe('starter');
    expect(license.backendPlan).toBe('lite');
    expect(license.effectiveLimits.maxUsers).toBe(PLAN_LIMITS.lite.maxUsers);
    expect(license.modules.patients).toBe('enabled');
  });

  it('applies business tier limits when subscriptionUiPlan is business', async () => {
    const prisma = makePrisma(makePlatformTenant('PRO'), {}, 'business');
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const license = await svc.resolveLicense(TENANT);
    expect(license.uiPlan).toBe('business');
    expect(license.effectiveLimits.maxUsers).toBe(120);
    expect(license.features.workflow).toBe('enabled');
  });

  it('applies grant bonuses to effective limits', async () => {
    const prisma = makePrisma(makePlatformTenant('LITE'), {
      subscriptionGrants: { usersBonus: 5, storageGbBonus: 10, aiCreditsBonus: 100 },
    });
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const license = await svc.resolveLicense(TENANT);
    expect(license.effectiveLimits.maxUsers).toBe(PLAN_LIMITS.lite.maxUsers + 5);
    expect(license.effectiveLimits.maxStorageGb).toBe(PLAN_LIMITS.lite.maxStorageGb + 10);
  });

  it('defaults to lite when no platform tenant exists', async () => {
    const prisma = makePrisma(null);
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const license = await svc.resolveLicense(TENANT);
    expect(license.uiPlan).toBe('starter');
    expect(license.status).toBe('active');
  });

  it('enforces user limit and throws PlanLimitExceededException', async () => {
    const prisma = makePrisma(makePlatformTenant('LITE'));
    prisma.user.count.mockResolvedValue(10);
    const tenantSub = makeTenantSubscriptionService(prisma);
    tenantSub.getUsage.mockResolvedValue({
      users: 10,
      branches: 0,
      patients: 0,
      appointmentsThisMonth: 0,
      reportsThisMonth: 0,
      apiCallsToday: 0,
      storageGb: 0,
      smsThisMonth: 0,
      whatsappThisMonth: 0,
      emailThisMonth: 0,
    });
    const svc = makeEngine(prisma, tenantSub);

    await expect(svc.enforceUserLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('previewPlanChange lists lost features on downgrade', async () => {
    const prisma = makePrisma(makePlatformTenant('PRO'), {}, 'business');
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const preview = await svc.previewPlanChange(TENANT, 'starter');
    expect(preview.direction).toBe('downgrade');
    expect(preview.lostFeatures).toContain('workflow');
    expect(preview.lostFeatures).toContain('analytics');
  });

  it('enterprise plan has unlimited users', async () => {
    const prisma = makePrisma(makePlatformTenant('ENTERPRISE', 'enterprise'));
    const tenantSub = makeTenantSubscriptionService(prisma);
    const svc = makeEngine(prisma, tenantSub);

    const license = await svc.resolveLicense(TENANT);
    expect(license.effectiveLimits.maxUsers).toBe(UNLIMITED);
    expect(license.features.whiteLabel).toBe('enabled');
  });
});


describe('USAGE_METERING_ENFORCEMENT_ENABLED flag', () => {
  const prev = process.env.USAGE_METERING_ENFORCEMENT_ENABLED;

  afterEach(() => {
    if (prev === undefined) delete process.env.USAGE_METERING_ENFORCEMENT_ENABLED;
    else process.env.USAGE_METERING_ENFORCEMENT_ENABLED = prev;
  });

  function makeEngineWithUsage(
    prisma: ReturnType<typeof makePrisma>,
    tenantSub: ReturnType<typeof makeTenantSubscriptionService>,
    usageEnforcement: { assertResourceAllowed: jest.Mock },
  ) {
    const { audit, lifecycleState } = makeAuditDeps();
    return new LicensingEngineService(
      prisma as never,
      tenantSub as never,
      audit,
      lifecycleState,
      undefined,
      usageEnforcement as never,
    );
  }

  it('flag-off uses legacy getUsage path and denies at limit', async () => {
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'false';
    const prisma = makePrisma(makePlatformTenant('LITE'));
    const tenantSub = makeTenantSubscriptionService(prisma);
    tenantSub.getUsage.mockResolvedValue({
      users: 10,
      branches: 0,
      patients: 0,
      appointmentsThisMonth: 0,
      reportsThisMonth: 0,
      apiCallsToday: 0,
      storageGb: 0,
      smsThisMonth: 0,
      whatsappThisMonth: 0,
      emailThisMonth: 0,
    });
    const usageEnforcement = {
      assertResourceAllowed: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const svc = makeEngineWithUsage(prisma, tenantSub, usageEnforcement);

    await expect(svc.enforceUserLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
    expect(usageEnforcement.assertResourceAllowed).not.toHaveBeenCalled();
    expect(tenantSub.getUsage).toHaveBeenCalled();
  });

  it('flag-on denies via UsageEnforcementService at limit (legacy skipped)', async () => {
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';
    const prisma = makePrisma(makePlatformTenant('LITE'));
    const tenantSub = makeTenantSubscriptionService(prisma);
    const usageEnforcement = {
      assertResourceAllowed: jest.fn().mockRejectedValue(
        new ForbiddenException({ code: 'limit_exceeded', message: 'limit_exceeded' }),
      ),
    };
    const svc = makeEngineWithUsage(prisma, tenantSub, usageEnforcement);

    await expect(svc.enforceUserLimit(TENANT)).rejects.toThrow(ForbiddenException);
    expect(usageEnforcement.assertResourceAllowed).toHaveBeenCalledWith(TENANT, 'users', '1');
    expect(tenantSub.getUsage).not.toHaveBeenCalled();
  });

  it('flag-on routes branch and patient limits through UsageEnforcementService', async () => {
    process.env.USAGE_METERING_ENFORCEMENT_ENABLED = 'true';
    const prisma = makePrisma(makePlatformTenant('LITE'));
    const tenantSub = makeTenantSubscriptionService(prisma);
    const usageEnforcement = {
      assertResourceAllowed: jest.fn().mockResolvedValue({ allowed: true }),
    };
    const svc = makeEngineWithUsage(prisma, tenantSub, usageEnforcement);

    await svc.enforceBranchLimit(TENANT);
    await svc.enforcePatientLimit(TENANT);
    expect(usageEnforcement.assertResourceAllowed).toHaveBeenCalledWith(TENANT, 'branches', '1');
    expect(usageEnforcement.assertResourceAllowed).toHaveBeenCalledWith(TENANT, 'patients', '1');
    expect(tenantSub.getUsage).not.toHaveBeenCalled();
  });
});
