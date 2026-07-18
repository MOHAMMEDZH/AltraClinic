import { hasPermission, type PermissionAction } from '@booking/permissions';
import { resolveAiPlanTier, type AiPlanTier } from '@/features/ai/config/ai-subscription';

export type SubscriptionPlanId = 'starter' | 'professional' | 'business' | 'enterprise';
export type BillingCycleId = 'monthly' | 'quarterly' | 'annual';
export type FeatureMatrixState = 'enabled' | 'disabled' | 'limited' | 'upgrade';

export const UNLIMITED = -1;

export interface PlanLimits {
  maxUsers: number;
  maxBranches: number;
  maxPatients: number;
  maxStorageGb: number;
  maxReportsPerMonth: number;
  maxApiRequestsPerDay: number;
  maxAppointmentsPerMonth: number;
}

export interface PlanCatalogEntry {
  id: SubscriptionPlanId;
  backendPlan: string;
  monthlyPrice: number;
  quarterlyPrice: number;
  annualPrice: number;
  currency: string;
  limits: PlanLimits;
  highlights: string[];
}

export interface FeatureMatrixRow {
  id: string;
  labelKey: string;
  category: 'core' | 'ai' | 'operations' | 'enterprise';
  plans: Record<SubscriptionPlanId, FeatureMatrixState>;
}

export const BILLING_CYCLES: BillingCycleId[] = ['monthly', 'quarterly', 'annual'];

const STARTER_LIMITS: PlanLimits = {
  maxUsers: 10,
  maxBranches: 1,
  maxPatients: 1000,
  maxStorageGb: 5,
  maxReportsPerMonth: 10,
  maxApiRequestsPerDay: 1000,
  maxAppointmentsPerMonth: 500,
};

const PRO_LIMITS: PlanLimits = {
  maxUsers: 50,
  maxBranches: 5,
  maxPatients: 10000,
  maxStorageGb: 50,
  maxReportsPerMonth: 100,
  maxApiRequestsPerDay: 10000,
  maxAppointmentsPerMonth: 5000,
};

const BUSINESS_LIMITS: PlanLimits = {
  maxUsers: 120,
  maxBranches: 20,
  maxPatients: 50000,
  maxStorageGb: 200,
  maxReportsPerMonth: UNLIMITED,
  maxApiRequestsPerDay: 50000,
  maxAppointmentsPerMonth: 25000,
};

const ENTERPRISE_LIMITS: PlanLimits = {
  maxUsers: UNLIMITED,
  maxBranches: UNLIMITED,
  maxPatients: UNLIMITED,
  maxStorageGb: UNLIMITED,
  maxReportsPerMonth: UNLIMITED,
  maxApiRequestsPerDay: UNLIMITED,
  maxAppointmentsPerMonth: UNLIMITED,
};

export const PLAN_CATALOG: PlanCatalogEntry[] = [
  {
    id: 'starter',
    backendPlan: 'lite',
    monthlyPrice: 49,
    quarterlyPrice: 132,
    annualPrice: 470,
    currency: 'USD',
    limits: STARTER_LIMITS,
    highlights: ['basicDashboard', 'basicPatients', 'basicScheduling', 'basicBilling', 'basicReports', 'basicAiChat'],
  },
  {
    id: 'professional',
    backendPlan: 'pro',
    monthlyPrice: 149,
    quarterlyPrice: 402,
    annualPrice: 1430,
    currency: 'USD',
    limits: PRO_LIMITS,
    highlights: ['medicalCopilot', 'dentalOrBeautyCopilot', 'reportingAi', 'moreUsers', 'moreBranches'],
  },
  {
    id: 'business',
    backendPlan: 'pro',
    monthlyPrice: 299,
    quarterlyPrice: 807,
    annualPrice: 2870,
    currency: 'USD',
    limits: BUSINESS_LIMITS,
    highlights: ['workflow', 'analytics', 'inventoryAi', 'billingAi', 'workflowAi', 'managementAi', 'unlimitedReports'],
  },
  {
    id: 'enterprise',
    backendPlan: 'enterprise',
    monthlyPrice: 0,
    quarterlyPrice: 0,
    annualPrice: 0,
    currency: 'USD',
    limits: ENTERPRISE_LIMITS,
    highlights: [
      'multiProviderAi',
      'customBranding',
      'whiteLabel',
      'organizationKnowledge',
      'advancedAudit',
      'customIntegrations',
      'unlimitedEverything',
    ],
  },
];

export const FEATURE_MATRIX: FeatureMatrixRow[] = [
  { id: 'dashboard', labelKey: 'subscription.features.dashboard', category: 'core', plans: { starter: 'enabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'patients', labelKey: 'subscription.features.patients', category: 'core', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'scheduling', labelKey: 'subscription.features.scheduling', category: 'core', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'billing', labelKey: 'subscription.features.billing', category: 'core', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'reports', labelKey: 'subscription.features.reports', category: 'core', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'aiChat', labelKey: 'subscription.features.aiChat', category: 'ai', plans: { starter: 'enabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'medicalCopilot', labelKey: 'subscription.features.medicalCopilot', category: 'ai', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'dentalCopilot', labelKey: 'subscription.features.dentalCopilot', category: 'ai', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'reportingAi', labelKey: 'subscription.features.reportingAi', category: 'ai', plans: { starter: 'upgrade', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'workflow', labelKey: 'subscription.features.workflow', category: 'operations', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'analytics', labelKey: 'subscription.features.analytics', category: 'operations', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'inventoryAi', labelKey: 'subscription.features.inventoryAi', category: 'ai', plans: { starter: 'disabled', professional: 'upgrade', business: 'enabled', enterprise: 'enabled' } },
  { id: 'apiAccess', labelKey: 'subscription.features.apiAccess', category: 'operations', plans: { starter: 'limited', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'integrations', labelKey: 'subscription.features.integrations', category: 'operations', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'prioritySupport', labelKey: 'subscription.features.prioritySupport', category: 'enterprise', plans: { starter: 'disabled', professional: 'enabled', business: 'enabled', enterprise: 'enabled' } },
  { id: 'customBranding', labelKey: 'subscription.features.customBranding', category: 'enterprise', plans: { starter: 'disabled', professional: 'disabled', business: 'limited', enterprise: 'enabled' } },
  { id: 'whiteLabel', labelKey: 'subscription.features.whiteLabel', category: 'enterprise', plans: { starter: 'disabled', professional: 'disabled', business: 'disabled', enterprise: 'enabled' } },
  { id: 'auditLogs', labelKey: 'subscription.features.auditLogs', category: 'enterprise', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'customRoles', labelKey: 'subscription.features.customRoles', category: 'enterprise', plans: { starter: 'disabled', professional: 'limited', business: 'enabled', enterprise: 'enabled' } },
  { id: 'multiProviderAi', labelKey: 'subscription.features.multiProviderAi', category: 'ai', plans: { starter: 'disabled', professional: 'disabled', business: 'disabled', enterprise: 'enabled' } },
  { id: 'organizationKnowledge', labelKey: 'subscription.features.organizationKnowledge', category: 'ai', plans: { starter: 'disabled', professional: 'disabled', business: 'limited', enterprise: 'enabled' } },
];

export function resolveSubscriptionPlanId(planName?: string | null): SubscriptionPlanId {
  return resolveAiPlanTier(planName) as SubscriptionPlanId;
}

export function getPlanById(planId: SubscriptionPlanId): PlanCatalogEntry {
  return PLAN_CATALOG.find((p) => p.id === planId) ?? PLAN_CATALOG[0];
}

export function getPlanLimits(planId: SubscriptionPlanId): PlanLimits {
  return getPlanById(planId).limits;
}

export function formatLimit(value: number): string {
  return value === UNLIMITED ? '∞' : String(value);
}

export function usagePercent(current: number, max: number): number {
  if (max === UNLIMITED || max <= 0) return 0;
  return Math.min(100, Math.round((current / max) * 100));
}

export function isUsageWarning(percent: number): boolean {
  return percent >= 80;
}

export function isUsageCritical(percent: number): boolean {
  return percent >= 95;
}

export function priceForCycle(plan: PlanCatalogEntry, cycle: BillingCycleId): number {
  if (plan.id === 'enterprise') return 0;
  if (cycle === 'quarterly') return plan.quarterlyPrice;
  if (cycle === 'annual') return plan.annualPrice;
  return plan.monthlyPrice;
}

export function annualSavings(plan: PlanCatalogEntry): number {
  if (plan.id === 'enterprise') return 0;
  return Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice);
}

export function featureStateForPlan(
  featureId: string,
  planId: SubscriptionPlanId,
): FeatureMatrixState {
  const row = FEATURE_MATRIX.find((f) => f.id === featureId);
  return row?.plans[planId] ?? 'disabled';
}

export function isFeatureEnabled(featureId: string, planId: SubscriptionPlanId): boolean {
  const state = featureStateForPlan(featureId, planId);
  return state === 'enabled' || state === 'limited';
}

export function buildSubscriptionPermCheck(roles: string[]) {
  return (resource: 'api.subscription' | 'api.platform_admin', action: PermissionAction = 'view') =>
    hasPermission(roles, resource, action);
}

export function canViewSubscription(perm: ReturnType<typeof buildSubscriptionPermCheck>): boolean {
  return perm('api.subscription', 'view');
}

export function canManageSubscription(perm: ReturnType<typeof buildSubscriptionPermCheck>): boolean {
  return perm('api.subscription', 'manage');
}

export function canViewPlatformAdmin(perm: ReturnType<typeof buildSubscriptionPermCheck>): boolean {
  return perm('api.platform_admin', 'view');
}

export function canManagePlatformAdmin(perm: ReturnType<typeof buildSubscriptionPermCheck>): boolean {
  return perm('api.platform_admin', 'manage');
}

export function comparePlanTier(current: SubscriptionPlanId, target: SubscriptionPlanId): 'upgrade' | 'downgrade' | 'same' {
  const order: SubscriptionPlanId[] = ['starter', 'professional', 'business', 'enterprise'];
  const ci = order.indexOf(current);
  const ti = order.indexOf(target);
  if (ci === ti) return 'same';
  return ti > ci ? 'upgrade' : 'downgrade';
}

export function lostFeaturesOnDowngrade(
  from: SubscriptionPlanId,
  to: SubscriptionPlanId,
): FeatureMatrixRow[] {
  return FEATURE_MATRIX.filter((row) => {
    const fromState = row.plans[from];
    const toState = row.plans[to];
    return (fromState === 'enabled' || fromState === 'limited') && (toState === 'disabled' || toState === 'upgrade');
  });
}

export function mapBackendPlanToUi(plan?: string | null): SubscriptionPlanId {
  return resolveSubscriptionPlanId(plan);
}

export function mapUiPlanToBackend(planId: SubscriptionPlanId): string {
  return getPlanById(planId).backendPlan;
}

export function tierRank(tier: AiPlanTier | SubscriptionPlanId): number {
  const order: SubscriptionPlanId[] = ['starter', 'professional', 'business', 'enterprise'];
  return order.indexOf(tier as SubscriptionPlanId);
}
