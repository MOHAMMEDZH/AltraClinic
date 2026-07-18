import {
  BillingCycle,
  FeatureAccessState,
  LicenseStatus,
  LicensedFeatureId,
  LicensedModuleId,
  ModuleAccessMode,
} from '../config/licensing.config';
import { PlanLimits, PlanFeatures } from './plan-limits.config';
import { UiSubscriptionPlan } from './plan-name.mapper';

export interface SubscriptionGrantHistoryEntry {
  action: string;
  grantType?: string;
  amount?: number;
  plan?: string;
  days?: number;
  note?: string | null;
  grantedBy: string;
  at: string;
}

export interface TenantLicenseGrants {
  aiCreditsBonus: number;
  storageGbBonus: number;
  usersBonus: number;
}

export interface TenantLicense {
  licenseId: string;
  tenantId: string;
  platformTenantId: string | null;
  displayName: string;
  uiPlan: UiSubscriptionPlan;
  backendPlan: string;
  platformPlan: string;
  status: LicenseStatus;
  subscriptionStatus: string;
  platformStatus: string | null;
  billingCycle: BillingCycle;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  trialEndsAt: string | null;
  contractEndDate: string | null;
  gracePeriodEndsAt: string | null;
  autoRenew: boolean;
  readOnly: boolean;
  limits: PlanLimits;
  effectiveLimits: PlanLimits;
  grants: TenantLicenseGrants;
  features: Record<LicensedFeatureId, FeatureAccessState>;
  modules: Record<LicensedModuleId, ModuleAccessMode>;
  backendFeatures: PlanFeatures;
  grantHistory: SubscriptionGrantHistoryEntry[];
  version: number;
}

export interface UsageLimitSnapshot {
  resource: string;
  current: number;
  maximum: number;
  remaining: number;
  percentUsed: number;
  warning: boolean;
  critical: boolean;
}

export interface TenantEntitlementsPayload {
  license: TenantLicense;
  usage: Record<string, number>;
  usageLimits: UsageLimitSnapshot[];
  canWrite: boolean;
  canMutate: boolean;
}

export interface PlanChangePreview {
  currentPlan: UiSubscriptionPlan;
  targetPlan: UiSubscriptionPlan;
  direction: 'upgrade' | 'downgrade' | 'same';
  effectiveDate: string;
  immediate: boolean;
  lostFeatures: LicensedFeatureId[];
  lostModules: LicensedModuleId[];
  limitChanges: Array<{ resource: string; from: number; to: number }>;
  warnings: string[];
}
