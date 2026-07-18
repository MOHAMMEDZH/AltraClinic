import { normalizeEntitlementPlan } from '../../../platform-admin/domain/value-objects/entitlement-plan';
import { SubscriptionPlanType } from '../value-objects/subscription-plan.vo';
import { PlanLimits, UNLIMITED } from './plan-limits.config';

export type UiSubscriptionPlan = 'starter' | 'professional' | 'business' | 'enterprise';

const UI_TO_SUBSCRIPTION: Record<UiSubscriptionPlan, SubscriptionPlanType> = {
  starter: 'lite',
  professional: 'pro',
  business: 'pro',
  enterprise: 'enterprise',
};

const SUBSCRIPTION_TO_UI: Record<SubscriptionPlanType, UiSubscriptionPlan> = {
  lite: 'starter',
  pro: 'professional',
  enterprise: 'enterprise',
};

const SUBSCRIPTION_ALIASES: Record<string, SubscriptionPlanType> = {
  lite: 'lite',
  pro: 'pro',
  enterprise: 'enterprise',
  starter: 'lite',
  growth: 'pro',
  professional: 'pro',
  business: 'pro',
  basic: 'lite',
  standard: 'pro',
  premium: 'enterprise',
};

export function normalizeSubscriptionPlan(value: unknown): SubscriptionPlanType {
  if (typeof value !== 'string' || !value.trim()) return 'lite';
  const key = value.trim().toLowerCase();
  if (SUBSCRIPTION_ALIASES[key]) return SUBSCRIPTION_ALIASES[key];
  const upper = value.trim().toUpperCase();
  if (upper === 'LITE') return 'lite';
  if (upper === 'PRO') return 'pro';
  if (upper === 'ENTERPRISE') return 'enterprise';
  return 'lite';
}

export function subscriptionPlanToPlatformPlan(plan: SubscriptionPlanType): string {
  if (plan === 'lite') return 'starter';
  if (plan === 'pro') return 'growth';
  return 'enterprise';
}

export function platformPlanToSubscriptionPlan(value: unknown): SubscriptionPlanType {
  const platform = normalizeEntitlementPlan(value);
  if (platform === 'starter') return 'lite';
  if (platform === 'growth') return 'pro';
  if (platform === 'enterprise') return 'enterprise';
  return normalizeSubscriptionPlan(value);
}

export function uiPlanToSubscriptionPlan(value: unknown): SubscriptionPlanType {
  if (typeof value === 'string') {
    const key = value.trim().toLowerCase() as UiSubscriptionPlan;
    if (UI_TO_SUBSCRIPTION[key]) return UI_TO_SUBSCRIPTION[key];
  }
  return normalizeSubscriptionPlan(value);
}

export function subscriptionPlanToUiPlan(
  plan: SubscriptionPlanType,
  uiTier?: string | null,
): UiSubscriptionPlan {
  if (uiTier === 'business' && plan === 'pro') return 'business';
  return SUBSCRIPTION_TO_UI[plan] ?? 'starter';
}

export const TENANT_SUBSCRIPTION_PLANS: Array<{
  id: UiSubscriptionPlan;
  backendPlan: SubscriptionPlanType;
  platformPlan: string;
  monthlyPrice: number;
  currency: string;
}> = [
  { id: 'starter', backendPlan: 'lite', platformPlan: 'starter', monthlyPrice: 49, currency: 'USD' },
  { id: 'professional', backendPlan: 'pro', platformPlan: 'growth', monthlyPrice: 149, currency: 'USD' },
  { id: 'business', backendPlan: 'pro', platformPlan: 'growth', monthlyPrice: 299, currency: 'USD' },
  { id: 'enterprise', backendPlan: 'enterprise', platformPlan: 'enterprise', monthlyPrice: 0, currency: 'USD' },
];

export interface UiPlanLimits {
  maxUsers: number;
  maxDoctors: number;
  maxBranches: number;
  maxPatients: number;
  maxAppointmentsPerMonth: number;
  maxReportsPerMonth: number;
  maxStorageGb: number;
  maxApiRequestsPerDay: number;
}

const BUSINESS_LIMITS: UiPlanLimits = {
  maxUsers: 120,
  maxDoctors: 40,
  maxBranches: 20,
  maxPatients: 50_000,
  maxAppointmentsPerMonth: 25_000,
  maxReportsPerMonth: UNLIMITED,
  maxStorageGb: 200,
  maxApiRequestsPerDay: 50_000,
};

const BUSINESS_COMMUNICATION = {
  maxEmailPerMonth: 10_000,
  maxSmsPerMonth: 1_000,
  maxWhatsappPerMonth: 500,
  maxPushPerMonth: 20_000,
};

export function getLimitsForUiPlan(uiPlan: string, backendLimits: PlanLimits): PlanLimits {
  if (uiPlan === 'business') {
    return { ...backendLimits, ...BUSINESS_LIMITS, ...BUSINESS_COMMUNICATION };
  }
  return backendLimits;
}
