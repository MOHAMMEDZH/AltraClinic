import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { hasPermission } from '@booking/permissions';
import { useAuth } from '@/app/providers/AuthProvider';
import { useBillingAnalytics, useBillingSummary, useInvoicesPaginated } from '@/features/billing/hooks/useBilling';
import { useDashboardOverview } from '@/features/dashboard/hooks/useDashboardOverview';
import { useAiOverview, useAiSubscriptionLimits } from '@/features/ai/hooks/useAiChat';
import {
  activatePlatformTenant,
  cancelSubscription,
  changePlatformTenantPlan,
  createSubscription,
  fetchPlatformTenants,
  fetchSubscriptions,
  resumePlatformTenant,
  suspendPlatformTenant,
} from '../api/subscription-api';
import {
  changeTenantSubscriptionPlan,
  fetchTenantEntitlements,
  fetchTenantLicense,
  fetchTenantSubscription,
  fetchTenantSubscriptionPayments,
  fetchTenantSubscriptionUsage,
  grantTenantEntitlements,
  grantTenantTrial,
  previewTenantPlanChange,
} from '../api/tenant-subscription-api';
import type { SubscriptionPlanId } from '../config/subscription-config';

export function useSubscriptionAccess() {
  const { user } = useAuth();
  const roles = user?.roles ?? [];
  return {
    canView: hasPermission(roles, 'api.subscription', 'view'),
    canCreate: hasPermission(roles, 'api.subscription', 'create'),
    canCancel: hasPermission(roles, 'api.subscription', 'delete'),
    canManage: hasPermission(roles, 'api.subscription', 'manage'),
    canViewPlatform: hasPermission(roles, 'api.platform_admin', 'view'),
    canManagePlatform: hasPermission(roles, 'api.platform_admin', 'manage'),
    canApprovePlatform: hasPermission(roles, 'api.platform_admin', 'approve'),
  };
}

export function useSubscriptionRecords(enabled = true, params?: { status?: string; plan?: string; search?: string }) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'records', user?.tenantId, params?.status, params?.plan],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const rows = await fetchSubscriptions(token, user.tenantId, {
        limit: 100,
        offset: 0,
        status: params?.status,
        plan: params?.plan,
      });
      if (!params?.search?.trim()) return rows;
      const q = params.search.toLowerCase();
      return rows.filter(
        (r) =>
          r.plan.toLowerCase().includes(q) ||
          r.status.toLowerCase().includes(q) ||
          r.subscriptionId.toLowerCase().includes(q),
      );
    },
    staleTime: 30_000,
  });
}

export function useTenantSubscription(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'tenant', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantSubscription(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useTenantLicense(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'license', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantLicense(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function useTenantEntitlements(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'entitlements', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantEntitlements(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function usePreviewPlanChange() {
  const { getValidAccessToken, user } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (plan: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return previewTenantPlanChange(token, user.tenantId, plan);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['subscription'] });
    },
  });
}

export function useTenantSubscriptionUsage(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'tenant-usage', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantSubscriptionUsage(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useTenantSubscriptionPayments(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'tenant-payments', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantSubscriptionPayments(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useSubscriptionUsage(enabled = true) {
  const dashboard = useDashboardOverview(undefined, '30d');
  const tenantUsage = useTenantSubscriptionUsage(enabled);
  const aiLimits = useAiSubscriptionLimits(enabled);
  const billing = useBillingSummary(enabled);
  const aiOverview = useAiOverview(enabled);
  return {
    isLoading: dashboard.isLoading || tenantUsage.isLoading || aiLimits.isLoading || billing.isLoading || aiOverview.isLoading,
    isError: dashboard.isError || tenantUsage.isError || aiLimits.isError || billing.isError || aiOverview.isError,
    dashboard: dashboard.data,
    tenantUsage: tenantUsage.data,
    ai: aiLimits.data,
    aiOverview: aiOverview.data,
    billing: billing.data,
    refetch: () => {
      void dashboard.refetch();
      void tenantUsage.refetch();
      void aiLimits.refetch();
      void billing.refetch();
      void aiOverview.refetch();
    },
  };
}

export function useSubscriptionAnalytics(enabled = true) {
  const billingAnalytics = useBillingAnalytics(90, enabled);
  const usage = useSubscriptionUsage(enabled);
  return { billingAnalytics, usage };
}

export function useSubscriptionInvoices(enabled = true, search?: string) {
  return useInvoicesPaginated({
    enabled,
    search,
    page: 1,
    pageSize: 50,
  });
}

export function useCreateSubscription() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createSubscription>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createSubscription(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

export function useCancelSubscription() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (subscriptionId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !user?.userId) throw new Error('Not authenticated');
      return cancelSubscription(token, user.tenantId, subscriptionId, user.userId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

export function usePlatformTenants(
  enabled = true,
  params?: { search?: string; plan?: string; status?: string },
) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['subscription', 'platform-tenants', user?.tenantId, params?.search, params?.plan, params?.status],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchPlatformTenants(token, user.tenantId, {
        limit: 100,
        offset: 0,
        search: params?.search,
        plan: params?.plan,
        status: params?.status,
      });
    },
    staleTime: 30_000,
  });
}

export function useChangePlatformPlan() {
  const { getValidAccessToken, user } = useAuth();
  const access = useSubscriptionAccess();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ platformTenantId, plan }: { platformTenantId: string; plan: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      if (access.canManagePlatform) {
        return changePlatformTenantPlan(token, user.tenantId, platformTenantId, plan);
      }
      return changeTenantSubscriptionPlan(token, user.tenantId, plan);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

export function useGrantTenantEntitlements() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      platformTenantId,
      grantType,
      amount,
      note,
    }: {
      platformTenantId: string;
      grantType: 'aiCredits' | 'storage' | 'users';
      amount: number;
      note?: string;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return grantTenantEntitlements(token, user.tenantId, platformTenantId, { grantType, amount, note });
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription'] }),
  });
}

export function useGrantTenantTrial() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      platformTenantId,
      plan,
      days,
    }: {
      platformTenantId: string;
      plan: string;
      days: number;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return grantTenantTrial(token, user.tenantId, platformTenantId, { plan, days });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['subscription'] });
      void qc.invalidateQueries({ queryKey: ['dashboard', 'overview'] });
    },
  });
}

export function useSuspendPlatformTenant() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ platformTenantId, reason }: { platformTenantId: string; reason: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return suspendPlatformTenant(token, user.tenantId, platformTenantId, reason);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription', 'platform-tenants'] }),
  });
}

export function useResumePlatformTenant() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platformTenantId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return resumePlatformTenant(token, user.tenantId, platformTenantId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription', 'platform-tenants'] }),
  });
}

export function useActivatePlatformTenant() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (platformTenantId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return activatePlatformTenant(token, user.tenantId, platformTenantId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['subscription', 'platform-tenants'] }),
  });
}

export function useDebouncedSearch(initial = '', delayMs = 300) {
  const [value, setValue] = useState(initial);
  const [debounced, setDebounced] = useState(initial);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return useMemo(() => ({ value, debounced, onChange: setValue }), [value, debounced]);
}
