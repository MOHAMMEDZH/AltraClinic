import { apiRequest } from '@/lib/api-client';
import type { SubscriptionPlanId } from '../config/subscription-config';

export interface TenantSubscriptionOverview {
  tenantId: string;
  platformTenantId: string | null;
  displayName: string;
  plan: string;
  uiPlan: SubscriptionPlanId;
  backendPlan: string;
  status: string;
  platformStatus: string | null;
  endDate: string | null;
  pricePerMonth: number;
  currency: string;
  trialEndsAt: string | null;
  contractEndDate: string | null;
  limits: {
    maxUsers: number;
    maxDoctors: number;
    maxBranches: number;
    maxPatients: number;
    maxAppointmentsPerMonth: number;
    maxReportsPerMonth: number;
    maxStorageGb: number;
    maxApiRequestsPerDay: number;
  };
  entitlements: {
    aiCreditsBonus: number;
    storageGbBonus: number;
    usersBonus: number;
  };
  grantHistory: Array<{
    action: string;
    grantType?: string;
    amount?: number;
    plan?: string;
    days?: number;
    note?: string | null;
    grantedBy: string;
    at: string;
  }>;
  payment: {
    method: string;
    reference: string | null;
    paidAt: string | null;
    autoRenew: boolean;
    billingCycleMonths: number;
  } | null;
}

export interface TenantSubscriptionPayment {
  subscriptionId: string;
  plan: string;
  status: string;
  amount: number;
  currency: string;
  method: string;
  reference: string | null;
  paidAt: string | null;
  startDate: string;
  endDate: string | null;
  autoRenew: boolean;
  billingCycleMonths: number;
}

export interface TenantSubscriptionUsage {
  users: number;
  branches: number;
  patients: number;
  appointmentsThisMonth: number;
  reportsThisMonth: number;
  apiCallsToday: number;
  storageGb: number;
  smsThisMonth: number;
  whatsappThisMonth: number;
  emailThisMonth: number;
}

export async function fetchTenantSubscription(token: string, tenantId: string) {
  return apiRequest<TenantSubscriptionOverview>('/tenant/subscription', { token, tenantId });
}

export async function fetchTenantSubscriptionPlans(token: string, tenantId: string) {
  return apiRequest<Array<{ id: SubscriptionPlanId; backendPlan: string; monthlyPrice: number; currency: string }>>(
    '/tenant/subscription/plans',
    { token, tenantId },
  );
}

export async function fetchTenantSubscriptionUsage(token: string, tenantId: string) {
  return apiRequest<TenantSubscriptionUsage>('/tenant/subscription/usage', { token, tenantId });
}

export async function fetchTenantSubscriptionPayments(token: string, tenantId: string) {
  return apiRequest<TenantSubscriptionPayment[]>('/tenant/subscription/payments', { token, tenantId });
}

export async function changeTenantSubscriptionPlan(
  token: string,
  tenantId: string,
  plan: string,
  reason?: string,
) {
  return apiRequest<{ changed: boolean; plan: string; uiPlan: string }>('/tenant/subscription/plan-change', {
    method: 'POST',
    token,
    tenantId,
    body: { plan, reason },
  });
}

export async function grantTenantEntitlements(
  token: string,
  tenantId: string,
  platformTenantId: string,
  body: { grantType: 'aiCredits' | 'storage' | 'users'; amount: number; note?: string },
) {
  return apiRequest(`/tenant/subscription/platform-tenants/${encodeURIComponent(platformTenantId)}/entitlements`, {
    method: 'PATCH',
    token,
    tenantId,
    body,
  });
}

export async function grantTenantTrial(
  token: string,
  tenantId: string,
  platformTenantId: string,
  body: { plan: string; days: number },
) {
  return apiRequest(`/tenant/subscription/platform-tenants/${encodeURIComponent(platformTenantId)}/trial`, {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export interface TenantLicensePayload {
  licenseId: string;
  tenantId: string;
  uiPlan: SubscriptionPlanId;
  backendPlan: string;
  status: string;
  subscriptionStatus: string;
  billingCycle: string;
  startDate: string | null;
  endDate: string | null;
  renewalDate: string | null;
  trialEndsAt: string | null;
  contractEndDate: string | null;
  gracePeriodEndsAt: string | null;
  autoRenew: boolean;
  readOnly: boolean;
  effectiveLimits: TenantSubscriptionOverview['limits'];
  grants: TenantSubscriptionOverview['entitlements'];
  features: Record<string, string>;
  modules: Record<string, string>;
  grantHistory: TenantSubscriptionOverview['grantHistory'];
}

export interface TenantEntitlementsPayload {
  license: TenantLicensePayload;
  usage: TenantSubscriptionUsage;
  usageLimits: Array<{
    resource: string;
    current: number;
    maximum: number;
    remaining: number;
    percentUsed: number;
    warning: boolean;
    critical: boolean;
  }>;
  canWrite: boolean;
  canMutate: boolean;
}

export interface PlanChangePreviewPayload {
  currentPlan: SubscriptionPlanId;
  targetPlan: SubscriptionPlanId;
  direction: 'upgrade' | 'downgrade' | 'same';
  effectiveDate: string;
  immediate: boolean;
  lostFeatures: string[];
  lostModules: string[];
  limitChanges: Array<{ resource: string; from: number; to: number }>;
  warnings: string[];
}

export async function fetchTenantLicense(token: string, tenantId: string) {
  return apiRequest<TenantLicensePayload>('/tenant/subscription/license', { token, tenantId });
}

export async function fetchTenantEntitlements(token: string, tenantId: string) {
  return apiRequest<TenantEntitlementsPayload>('/tenant/subscription/entitlements', { token, tenantId });
}

export async function previewTenantPlanChange(token: string, tenantId: string, plan: string) {
  return apiRequest<PlanChangePreviewPayload>('/tenant/subscription/plan-change/preview', {
    method: 'POST',
    token,
    tenantId,
    body: { plan },
  });
}
