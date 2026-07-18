import { SubscriptionEnforcementService } from '../application/services/subscription-enforcement.service';
import { LicensingEngineService } from '../application/services/licensing-engine.service';
import { PrismaService } from '../../../infrastructure/prisma.service';
import { PlanLimitExceededException } from '../domain/exceptions/plan-limit-exceeded.exception';
import { PLAN_LIMITS, UNLIMITED } from '../domain/config/plan-limits.config';

function mapPlanToEnum(plan: string): 'LITE' | 'PRO' | 'ENTERPRISE' {
  const p = plan.toLowerCase();
  if (p === 'pro' || p === 'standard' || p === 'growth' || p === 'professional' || p === 'business') return 'PRO';
  if (p === 'enterprise' || p === 'premium') return 'ENTERPRISE';
  return 'LITE';
}

function platformTenantMock(plan: string) {
  const prismaPlan = mapPlanToEnum(plan);
  return {
    id: 'pt-1',
    tenantId: TENANT,
    displayName: 'Clinic',
    plan: prismaPlan,
    status: 'ACTIVE',
    trialEndsAt: null,
    contractEndDate: new Date(Date.now() + 86_400_000 * 30),
    contractStartDate: new Date(),
    suspendedAt: null,
    platformSubscriptions: [
      {
        id: 'sub-1',
        plan: prismaPlan,
        status: 'ACTIVE',
        startDate: new Date(),
        endDate: null,
        autoRenew: true,
        billingCycleMonths: 1,
      },
    ],
  };
}

const defaultUsage = {
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
};

// ---------------------------------------------------------------------------
// PrismaService mock factory
// ---------------------------------------------------------------------------
const makePrisma = (overrides: Partial<PrismaMock> = {}, plan?: string | null): PrismaMock =>
  Object.assign(
    {
      clinicSubscription: { findFirst: jest.fn() },
      tenant: {
        findUnique: jest.fn().mockResolvedValue({
          id: TENANT,
          name: 'Clinic',
          features: plan === 'business' ? { subscriptionUiPlan: 'business' } : {},
          trialEndsAt: null,
        }),
      },
      platformTenant: {
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(plan ? platformTenantMock(plan) : null),
      },
      user: { count: jest.fn() },
      patient: { count: jest.fn() },
      appointment: { count: jest.fn() },
      branch: { count: jest.fn() },
      mediaAsset: { findMany: jest.fn().mockResolvedValue([]) },
      analyticsReportRecord: { count: jest.fn().mockResolvedValue(0) },
      operationalReportRecord: { count: jest.fn().mockResolvedValue(0) },
      notification: { count: jest.fn().mockResolvedValue(0) },
      aiUsageDaily: { aggregate: jest.fn().mockResolvedValue({ _sum: { messageCount: 0 } }) },
    },
    overrides,
  ) as unknown as PrismaMock;

interface PrismaMock {
  clinicSubscription: { findFirst: jest.Mock };
  tenant: { findUnique: jest.Mock };
  platformTenant: { count: jest.Mock; findUnique: jest.Mock };
  user: { count: jest.Mock };
  patient: { count: jest.Mock };
  appointment: { count: jest.Mock };
  branch: { count: jest.Mock };
  mediaAsset: { findMany: jest.Mock };
  analyticsReportRecord: { count: jest.Mock };
  operationalReportRecord: { count: jest.Mock };
  notification: { count: jest.Mock };
  aiUsageDaily: { aggregate: jest.Mock };
}

const TENANT = 'tenant-abc-123';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildSvc(prisma: PrismaMock, usageSnapshot = defaultUsage): SubscriptionEnforcementService {
  const tenantSub = {
    getUsage: jest.fn().mockResolvedValue(usageSnapshot),
    resolveRequestedPlan: jest.fn(),
  };
  const audit = { recordLicenseEvent: jest.fn().mockResolvedValue(undefined) } as never;
  const lifecycleState = {
    syncFromResolvedLicense: jest.fn().mockResolvedValue(undefined),
    persistKnownStatus: jest.fn().mockResolvedValue(undefined),
  } as never;
  const licensing = new LicensingEngineService(
    prisma as unknown as PrismaService,
    tenantSub as never,
    audit,
    lifecycleState,
  );
  return new SubscriptionEnforcementService(licensing);
}

function withUsage(overrides: Partial<typeof defaultUsage>) {
  return { ...defaultUsage, ...overrides };
}

// ===========================================================================
// Plan Limits Config
// ===========================================================================
describe('PLAN_LIMITS config', () => {
  it('lite has correct defaults', () => {
    const l = PLAN_LIMITS.lite;
    expect(l.maxUsers).toBe(10);
    expect(l.maxDoctors).toBe(3);
    expect(l.maxBranches).toBe(1);
    expect(l.maxPatients).toBe(1_000);
    expect(l.maxAppointmentsPerMonth).toBe(500);
    expect(l.maxReportsPerMonth).toBe(10);
    expect(l.features.aiModels).toBe(false);
    expect(l.features.loyaltyProgram).toBe(false);
    expect(l.features.advancedAnalytics).toBe(false);
    expect(l.features.customWorkflows).toBe(false);
  });

  it('pro has correct defaults', () => {
    const p = PLAN_LIMITS.pro;
    expect(p.maxUsers).toBe(50);
    expect(p.maxDoctors).toBe(20);
    expect(p.maxBranches).toBe(5);
    expect(p.maxPatients).toBe(10_000);
    expect(p.maxAppointmentsPerMonth).toBe(5_000);
    expect(p.features.aiModels).toBe(false);
    expect(p.features.loyaltyProgram).toBe(true);
    expect(p.features.advancedAnalytics).toBe(true);
    expect(p.features.customWorkflows).toBe(true);
  });

  it('enterprise has all limits unlimited and all features enabled', () => {
    const e = PLAN_LIMITS.enterprise;
    expect(e.maxUsers).toBe(UNLIMITED);
    expect(e.maxDoctors).toBe(UNLIMITED);
    expect(e.maxBranches).toBe(UNLIMITED);
    expect(e.maxPatients).toBe(UNLIMITED);
    expect(e.maxAppointmentsPerMonth).toBe(UNLIMITED);
    expect(e.features.aiModels).toBe(true);
    expect(e.features.loyaltyProgram).toBe(true);
    expect(e.features.advancedAnalytics).toBe(true);
    expect(e.features.customWorkflows).toBe(true);
    expect(e.features.multiCurrency).toBe(true);
  });
});

// ===========================================================================
// getActivePlanLimits
// ===========================================================================
describe('SubscriptionEnforcementService.getActivePlanLimits', () => {
  it('defaults to lite when no active subscription exists', async () => {
    const prisma = makePrisma({}, null);
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('lite');
  });

  it('returns lite plan when subscription plan is "lite"', async () => {
    const prisma = makePrisma({}, 'lite');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('lite');
    expect(limits.maxUsers).toBe(10);
  });

  it('returns pro plan when subscription plan is "pro"', async () => {
    const prisma = makePrisma({}, 'pro');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('pro');
    expect(limits.maxUsers).toBe(50);
  });

  it('returns enterprise plan when subscription plan is "enterprise"', async () => {
    const prisma = makePrisma({}, 'enterprise');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('enterprise');
    expect(limits.maxUsers).toBe(UNLIMITED);
  });

  it('normalises legacy "basic" to lite', async () => {
    const prisma = makePrisma({}, 'basic');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('lite');
  });

  it('normalises legacy "standard" to pro', async () => {
    const prisma = makePrisma({}, 'standard');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('pro');
  });

  it('normalises legacy "premium" to enterprise', async () => {
    const prisma = makePrisma({}, 'premium');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('enterprise');
  });

  it('defaults to lite for empty tenantId', async () => {
    const prisma = makePrisma({}, null);
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits('');
    expect(limits.planName).toBe('lite');
  });

  it('returns enterprise for enterprise platform tenant', async () => {
    const prisma = makePrisma({}, 'enterprise');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('enterprise');
  });

  it('defaults to lite for unknown plan string', async () => {
    const prisma = makePrisma({}, 'unknown_plan');
    const svc = buildSvc(prisma);
    const limits = await svc.getActivePlanLimits(TENANT);
    expect(limits.planName).toBe('lite');
  });
});

// ===========================================================================
// enforceUserLimit
// ===========================================================================
describe('enforceUserLimit', () => {
  describe('Lite plan (max 10 users)', () => {
    it('allows when below limit', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma, withUsage({ users: 9 })).enforceUserLimit(TENANT)).resolves.not.toThrow();
    });

    it('throws at exactly the limit', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma, withUsage({ users: 10 })).enforceUserLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
    });

    it('throws above the limit', async () => {
      const prisma = makePrisma({}, 'lite');
      const err = await buildSvc(prisma, withUsage({ users: 15 })).enforceUserLimit(TENANT).catch((e) => e);
      expect(err).toBeInstanceOf(PlanLimitExceededException);
      expect(err.message ?? err.response?.message).toContain('users');
    });
  });

  describe('Pro plan (max 50 users)', () => {
    it('allows 49 users', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma, withUsage({ users: 49 })).enforceUserLimit(TENANT)).resolves.not.toThrow();
    });

    it('throws at 50 users', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma, withUsage({ users: 50 })).enforceUserLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
    });
  });

  describe('Enterprise plan (unlimited)', () => {
    it('never throws regardless of user count', async () => {
      const prisma = makePrisma({}, 'enterprise');
      await expect(buildSvc(prisma, withUsage({ users: 10_000 })).enforceUserLimit(TENANT)).resolves.not.toThrow();
    });
  });

  describe('No subscription (defaults to lite)', () => {
    it('throws when at limit and no active subscription', async () => {
      const prisma = makePrisma({}, null);
      await expect(buildSvc(prisma, withUsage({ users: 10 })).enforceUserLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
    });
  });
});

// ===========================================================================
// enforceDoctorLimit
// ===========================================================================
describe('enforceDoctorLimit', () => {
  it('throws at lite limit (3)', async () => {
    const prisma = makePrisma({}, 'lite');
    prisma.user.count.mockResolvedValue(3);
    await expect(buildSvc(prisma).enforceDoctorLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('allows 2 doctors on lite', async () => {
    const prisma = makePrisma({}, 'lite');
    prisma.user.count.mockResolvedValue(2);
    await expect(buildSvc(prisma).enforceDoctorLimit(TENANT)).resolves.not.toThrow();
  });

  it('throws at pro limit (20)', async () => {
    const prisma = makePrisma({}, 'pro');
    prisma.user.count.mockResolvedValue(20);
    await expect(buildSvc(prisma).enforceDoctorLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('enterprise: does not call count query', async () => {
    const prisma = makePrisma({}, 'enterprise');
    prisma.user.count.mockResolvedValue(999);
    await expect(buildSvc(prisma).enforceDoctorLimit(TENANT)).resolves.not.toThrow();
    expect(prisma.user.count).not.toHaveBeenCalled();
  });
});

// ===========================================================================
// enforcePatientLimit
// ===========================================================================
describe('enforcePatientLimit', () => {
  it('lite: throws at 1000 patients', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ patients: 1_000 })).enforcePatientLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('lite: allows 999 patients', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ patients: 999 })).enforcePatientLimit(TENANT)).resolves.not.toThrow();
  });

  it('pro: throws at 10000 patients', async () => {
    const prisma = makePrisma({}, 'pro');
    await expect(buildSvc(prisma, withUsage({ patients: 10_000 })).enforcePatientLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('enterprise: allows any number', async () => {
    const prisma = makePrisma({}, 'enterprise');
    await expect(buildSvc(prisma, withUsage({ patients: 999_999 })).enforcePatientLimit(TENANT)).resolves.not.toThrow();
  });
});

// ===========================================================================
// enforceAppointmentLimit
// ===========================================================================
describe('enforceAppointmentLimit', () => {
  it('lite: throws at 500 appointments this month', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ appointmentsThisMonth: 500 })).enforceAppointmentLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('lite: allows 499 appointments', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ appointmentsThisMonth: 499 })).enforceAppointmentLimit(TENANT)).resolves.not.toThrow();
  });

  it('pro: throws at 5000 appointments', async () => {
    const prisma = makePrisma({}, 'pro');
    await expect(buildSvc(prisma, withUsage({ appointmentsThisMonth: 5_000 })).enforceAppointmentLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('enterprise: does not enforce a cap', async () => {
    const prisma = makePrisma({}, 'enterprise');
    await expect(buildSvc(prisma, withUsage({ appointmentsThisMonth: 100_000 })).enforceAppointmentLimit(TENANT)).resolves.not.toThrow();
  });
});

// ===========================================================================
// enforceBranchLimit
// ===========================================================================
describe('enforceBranchLimit', () => {
  it('lite: throws at 1 branch', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ branches: 1 })).enforceBranchLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('lite: allows 0 branches', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ branches: 0 })).enforceBranchLimit(TENANT)).resolves.not.toThrow();
  });

  it('pro: allows 4 branches', async () => {
    const prisma = makePrisma({}, 'pro');
    await expect(buildSvc(prisma, withUsage({ branches: 4 })).enforceBranchLimit(TENANT)).resolves.not.toThrow();
  });

  it('pro: throws at 5 branches', async () => {
    const prisma = makePrisma({}, 'pro');
    await expect(buildSvc(prisma, withUsage({ branches: 5 })).enforceBranchLimit(TENANT)).rejects.toThrow(PlanLimitExceededException);
  });

  it('enterprise: never throws', async () => {
    const prisma = makePrisma({}, 'enterprise');
    await expect(buildSvc(prisma, withUsage({ branches: 500 })).enforceBranchLimit(TENANT)).resolves.not.toThrow();
  });
});

// ===========================================================================
// enforceStorageLimit
// ===========================================================================
describe('enforceStorageLimit', () => {
  const GB = 1024 * 1024 * 1024;

  it('lite: throws when upload would exceed 5 GB', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ storageGb: 5 })).enforceStorageLimit(TENANT, 100)).rejects.toThrow(PlanLimitExceededException);
  });

  it('lite: allows upload within 5 GB quota', async () => {
    const prisma = makePrisma({}, 'lite');
    await expect(buildSvc(prisma, withUsage({ storageGb: 1 })).enforceStorageLimit(TENANT, 100)).resolves.not.toThrow();
  });

  it('enterprise: never throws', async () => {
    const prisma = makePrisma({}, 'enterprise');
    await expect(buildSvc(prisma, withUsage({ storageGb: 999 })).enforceStorageLimit(TENANT, 999 * GB)).resolves.not.toThrow();
  });
});

// ===========================================================================
// enforceFeature
// ===========================================================================
describe('enforceFeature', () => {
  describe('aiModels feature', () => {
    it('lite: throws (aiModels = false)', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'aiModels')).rejects.toThrow(PlanLimitExceededException);
    });

    it('pro: throws (aiModels = false)', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'aiModels')).rejects.toThrow(PlanLimitExceededException);
    });

    it('enterprise: allows (aiModels = true)', async () => {
      const prisma = makePrisma({}, 'enterprise');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'aiModels')).resolves.not.toThrow();
    });
  });

  describe('loyaltyProgram feature', () => {
    it('lite: throws', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'loyaltyProgram')).rejects.toThrow(PlanLimitExceededException);
    });

    it('pro: allows', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'loyaltyProgram')).resolves.not.toThrow();
    });

    it('enterprise: allows', async () => {
      const prisma = makePrisma({}, 'enterprise');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'loyaltyProgram')).resolves.not.toThrow();
    });
  });

  describe('advancedAnalytics feature', () => {
    it('lite: throws', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'advancedAnalytics')).rejects.toThrow(PlanLimitExceededException);
    });

    it('pro: allows', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'advancedAnalytics')).resolves.not.toThrow();
    });

    it('enterprise: allows', async () => {
      const prisma = makePrisma({}, 'enterprise');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'advancedAnalytics')).resolves.not.toThrow();
    });
  });

  describe('customWorkflows feature', () => {
    it('lite: throws', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'customWorkflows')).rejects.toThrow(PlanLimitExceededException);
    });

    it('pro: allows', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'customWorkflows')).resolves.not.toThrow();
    });
  });

  describe('multiCurrency feature', () => {
    it('lite: throws', async () => {
      const prisma = makePrisma({}, 'lite');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'multiCurrency')).rejects.toThrow(PlanLimitExceededException);
    });

    it('pro: throws (multiCurrency is enterprise-only)', async () => {
      const prisma = makePrisma({}, 'pro');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'multiCurrency')).rejects.toThrow(PlanLimitExceededException);
    });

    it('enterprise: allows', async () => {
      const prisma = makePrisma({}, 'enterprise');
      await expect(buildSvc(prisma).enforceFeature(TENANT, 'multiCurrency')).resolves.not.toThrow();
    });
  });

  describe('PlanLimitExceededException response shape', () => {
    it('contains upgradeRequired flag and resource name', async () => {
      const prisma = makePrisma({}, 'lite');

      let err: PlanLimitExceededException | null = null;
      try {
        await buildSvc(prisma, withUsage({ users: 10 })).enforceUserLimit(TENANT);
      } catch (e) {
        err = e as PlanLimitExceededException;
      }

      expect(err).not.toBeNull();
      const response = err!.getResponse() as Record<string, unknown>;
      expect(response.upgradeRequired).toBe(true);
      expect(response.resource).toBe('users');
      expect(response.currentPlan).toBe('lite');
      expect(response.limit).toBe(10);
    });
  });
});
