import { apiRequest } from '@/lib/api-client';
import type {
  PlatformTenantListItem,
  SubscriptionCreateInput,
  SubscriptionRecord,
} from '../types/subscription.types';

export async function fetchSubscriptions(
  token: string,
  tenantId: string,
  params?: { status?: string; plan?: string; limit?: number; offset?: number },
) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set('status', params.status);
  if (params?.plan) qs.set('plan', params.plan);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  return apiRequest<SubscriptionRecord[]>(`/subscriptions${suffix}`, { token, tenantId });
}

export async function createSubscription(
  token: string,
  tenantId: string,
  body: SubscriptionCreateInput,
) {
  return apiRequest<SubscriptionRecord>('/subscriptions', {
    method: 'POST',
    token,
    tenantId,
    body,
  });
}

export async function cancelSubscription(
  token: string,
  tenantId: string,
  subscriptionId: string,
  canceledBy: string,
) {
  return apiRequest<{ subscriptionId: string; status: string }>(
    `/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`,
    {
      method: 'POST',
      token,
      tenantId,
      body: { canceledBy },
    },
  );
}

export async function fetchPlatformTenants(
  token: string,
  tenantId: string,
  params?: { search?: string; limit?: number; offset?: number; plan?: string; status?: string },
) {
  const qs = new URLSearchParams();
  if (params?.search) qs.set('search', params.search);
  if (params?.limit) qs.set('limit', String(params.limit));
  if (params?.offset) qs.set('offset', String(params.offset));
  if (params?.plan) qs.set('plan', params.plan);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const page = await apiRequest<{ items: PlatformTenantListItem[] }>(`/platform/tenants${suffix}`, {
    token,
    tenantId,
  });
  return page.items ?? [];
}

export async function suspendPlatformTenant(
  token: string,
  tenantId: string,
  platformTenantId: string,
  reason: string,
) {
  return apiRequest(`/platform/tenants/${encodeURIComponent(platformTenantId)}/suspend`, {
    method: 'POST',
    token,
    tenantId,
    body: { reason },
  });
}

export async function resumePlatformTenant(
  token: string,
  tenantId: string,
  platformTenantId: string,
) {
  return apiRequest(`/platform/tenants/${encodeURIComponent(platformTenantId)}/resume`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function activatePlatformTenant(
  token: string,
  tenantId: string,
  platformTenantId: string,
) {
  return apiRequest(`/platform/tenants/${encodeURIComponent(platformTenantId)}/activate`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function changePlatformTenantPlan(
  token: string,
  tenantId: string,
  platformTenantId: string,
  plan: string,
) {
  return apiRequest(`/platform/tenants/${encodeURIComponent(platformTenantId)}/plan`, {
    method: 'PATCH',
    token,
    tenantId,
    body: { plan },
  });
}
