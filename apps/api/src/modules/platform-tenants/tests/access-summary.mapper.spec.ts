import { UNLIMITED } from '../../subscription/domain/config/plan-limits.config';
import type { TenantLicense } from '../../subscription/domain/types/tenant-license.types';
import {
  findAccessCapability,
  mapTenantLicenseToAccessSummary,
} from '../application/access-summary.mapper';

function makeLicense(overrides: Partial<TenantLicense> = {}): TenantLicense {
  return {
    licenseId: 'lic-1',
    tenantId: 'tenant-1',
    platformTenantId: 'pt-1',
    displayName: 'Clinic',
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
    limits: {
      planName: 'lite',
      maxUsers: 5,
      maxDoctors: 2,
      maxBranches: 1,
      maxPatients: 1000,
      maxAppointmentsPerMonth: 500,
      maxReportsPerMonth: 50,
      maxStorageGb: 10,
      maxApiRequestsPerDay: 1000,
      maxEmailPerMonth: 100,
      maxSmsPerMonth: 50,
      maxWhatsappPerMonth: 0,
      maxPushPerMonth: 200,
    },
    effectiveLimits: {
      planName: 'lite',
      maxUsers: UNLIMITED,
      maxDoctors: 2,
      maxBranches: 1,
      maxPatients: 1000,
      maxAppointmentsPerMonth: 500,
      maxReportsPerMonth: 50,
      maxStorageGb: 10,
      maxApiRequestsPerDay: 1000,
      maxEmailPerMonth: 100,
      maxSmsPerMonth: 50,
      maxWhatsappPerMonth: 0,
      maxPushPerMonth: 200,
    },
    grants: { usersBonus: 1, storageGbBonus: 0, aiCreditsBonus: 0 },
    features: {} as TenantLicense['features'],
    modules: {} as TenantLicense['modules'],
    backendFeatures: {} as TenantLicense['backendFeatures'],
    grantHistory: [{ action: 'grant', grantedBy: 'admin-1', at: '2026-01-01T00:00:00.000Z' }],
    version: 1,
    ...overrides,
  };
}

describe('access-summary.mapper', () => {
  it('maps UNLIMITED limits to unlimited capability flags', () => {
    const summary = mapTenantLicenseToAccessSummary(makeLicense());
    const maxUsers = summary.limits.find((l) => l.key === 'maxUsers');
    expect(maxUsers?.unlimited).toBe(true);
    expect(maxUsers?.value).toBeNull();
  });

  it('marks usage unavailable and omits grant history actors', () => {
    const summary = mapTenantLicenseToAccessSummary(makeLicense());
    expect(summary.usage.availability).toBe('unavailable');
    expect(summary.knownLimitations.some((n) => n.includes('Grant history'))).toBe(true);
    expect(JSON.stringify(summary)).not.toContain('admin-1');
  });

  it('finds capability by key across modules/features/limits', () => {
    const summary = mapTenantLicenseToAccessSummary(makeLicense());
    expect(findAccessCapability(summary, 'maxUsers')?.kind).toBe('limit');
    expect(findAccessCapability(summary, 'missing')).toBeNull();
  });
});
