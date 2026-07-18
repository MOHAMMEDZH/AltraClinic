/**
 * Deterministic licensing E2E tenants — seeded by apps/api/prisma/seed-licensing-e2e.mjs
 * Keep IDs in sync with seed file.
 */
export const LIC_E2E_PASSWORD = 'LicE2e123!';

export type LicensingE2eScenarioKey =
  | 'licensed'
  | 'trial'
  | 'grace'
  | 'expired'
  | 'suspended'
  | 'cancelled'
  | 'enterprise'
  | 'starter'
  | 'professional';

export interface LicensingE2eTenant {
  key: LicensingE2eScenarioKey;
  tenantId: string;
  email: string;
  password: string;
  expectedStatus: string;
  expectedUiPlan: string;
  canWrite: boolean;
  canMutate: boolean;
  readOnly: boolean;
  moduleAccess: 'allowed' | 'denied';
}

export const LICENSING_E2E_TENANTS: Record<LicensingE2eScenarioKey, LicensingE2eTenant> = {
  licensed: {
    key: 'licensed',
    tenantId: 'b1000000-0000-4000-8000-000000000101',
    email: 'licensed@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'active',
    expectedUiPlan: 'professional',
    canWrite: true,
    canMutate: true,
    readOnly: false,
    moduleAccess: 'allowed',
  },
  trial: {
    key: 'trial',
    tenantId: 'b1000000-0000-4000-8000-000000000102',
    email: 'trial@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'trial',
    expectedUiPlan: 'professional',
    canWrite: true,
    canMutate: true,
    readOnly: false,
    moduleAccess: 'allowed',
  },
  grace: {
    key: 'grace',
    tenantId: 'b1000000-0000-4000-8000-000000000103',
    email: 'grace@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'grace',
    expectedUiPlan: 'professional',
    canWrite: false,
    canMutate: false,
    readOnly: true,
    moduleAccess: 'denied',
  },
  expired: {
    key: 'expired',
    tenantId: 'b1000000-0000-4000-8000-000000000104',
    email: 'expired@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'expired',
    expectedUiPlan: 'professional',
    canWrite: false,
    canMutate: false,
    readOnly: false,
    moduleAccess: 'denied',
  },
  suspended: {
    key: 'suspended',
    tenantId: 'b1000000-0000-4000-8000-000000000105',
    email: 'suspended@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'suspended',
    expectedUiPlan: 'professional',
    canWrite: false,
    canMutate: false,
    readOnly: true,
    moduleAccess: 'denied',
  },
  cancelled: {
    key: 'cancelled',
    tenantId: 'b1000000-0000-4000-8000-000000000106',
    email: 'cancelled@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'cancelled',
    expectedUiPlan: 'professional',
    canWrite: false,
    canMutate: false,
    readOnly: false,
    moduleAccess: 'denied',
  },
  enterprise: {
    key: 'enterprise',
    tenantId: 'b1000000-0000-4000-8000-000000000107',
    email: 'enterprise@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'active',
    expectedUiPlan: 'enterprise',
    canWrite: true,
    canMutate: true,
    readOnly: false,
    moduleAccess: 'allowed',
  },
  starter: {
    key: 'starter',
    tenantId: 'b1000000-0000-4000-8000-000000000108',
    email: 'starter@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'active',
    expectedUiPlan: 'starter',
    canWrite: true,
    canMutate: true,
    readOnly: false,
    moduleAccess: 'allowed',
  },
  professional: {
    key: 'professional',
    tenantId: 'b1000000-0000-4000-8000-000000000109',
    email: 'professional@lic-e2e.clinic',
    password: LIC_E2E_PASSWORD,
    expectedStatus: 'active',
    expectedUiPlan: 'professional',
    canWrite: true,
    canMutate: true,
    readOnly: false,
    moduleAccess: 'allowed',
  },
};

export const LIFECYCLE_SCENARIO_KEYS: LicensingE2eScenarioKey[] = [
  'licensed',
  'trial',
  'grace',
  'expired',
  'suspended',
  'cancelled',
];

export const PLAN_SCENARIO_KEYS: LicensingE2eScenarioKey[] = [
  'starter',
  'professional',
  'enterprise',
];
