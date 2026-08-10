import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import * as api from '../api/integrations-ops-api';

const ROOT = ['api-integrations'] as const;

function useAuthContext() {
  const { getValidAccessToken, user } = useAuth();
  return { getValidAccessToken, tenantId: user?.tenantId };
}

export function useIntegrationsOpsDashboard(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'dashboard', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsDashboard(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useIntegrationsHealth(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'health', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchIntegrationsHealth(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });
}

export function useCredentials(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'credentials', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      const res = await api.listCredentials(token, tenantId);
      return res.credentials;
    },
    enabled: Boolean(tenantId) && enabled,
    staleTime: 5_000,
  });
}

export function useCredential(id: string | undefined, enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'credential', tenantId, id],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId || !id) throw new Error('Not authenticated');
      const res = await api.getCredential(token, tenantId, id);
      return res.credential;
    },
    enabled: Boolean(tenantId && id) && enabled,
  });
}

export function useServiceAccounts(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'service-accounts', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      const res = await api.listServiceAccounts(token, tenantId);
      return res.serviceAccounts;
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useWebhookSubscriptions(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'subscriptions', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      const res = await api.listWebhookSubscriptions(token, tenantId);
      return res.subscriptions ?? [];
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useWebhookDeliveries(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'deliveries', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      const res = await api.listWebhookDeliveries(token, tenantId);
      return res.deliveries ?? [];
    },
    enabled: Boolean(tenantId) && enabled,
    refetchInterval: 10_000,
  });
}

export function useOpsScopes(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'scopes', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsScopes(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useOpsProviders(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'providers', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsProviders(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useOpsConfiguration(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'configuration', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsConfiguration(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useOpsPermissions(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'permissions', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsPermissions(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useOpsMetricsCatalog(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'metrics-catalog', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchOpsMetricsCatalog(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useGatewayDiagnostics(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'gateway-diag', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchGatewayDiagnostics(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
    refetchInterval: 15_000,
  });
}

export function useGatewayQuotas(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'quotas', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchGatewayQuotas(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
  });
}

export function useGatewayUsage(enabled = true) {
  const { getValidAccessToken, tenantId } = useAuthContext();
  return useQuery({
    queryKey: [...ROOT, 'usage', tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !tenantId) throw new Error('Not authenticated');
      return api.fetchGatewayUsage(token, tenantId);
    },
    enabled: Boolean(tenantId) && enabled,
    refetchInterval: 15_000,
  });
}

export function useIntegrationsMutations() {
  const qc = useQueryClient();
  const { getValidAccessToken, tenantId } = useAuthContext();

  const invalidate = () =>
    qc.invalidateQueries({ queryKey: [...ROOT] });

  const withAuth = async <T,>(fn: (token: string, tid: string) => Promise<T>) => {
    const token = await getValidAccessToken();
    if (!token || !tenantId) throw new Error('Not authenticated');
    return fn(token, tenantId);
  };

  return {
    createCredential: useMutation({
      mutationFn: (body: Parameters<typeof api.createCredential>[2]) =>
        withAuth((t, tid) => api.createCredential(t, tid, body)),
      onSuccess: invalidate,
    }),
    rotateCredential: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.rotateCredential(t, tid, id)),
      onSuccess: invalidate,
    }),
    revokeCredential: useMutation({
      mutationFn: (input: { id: string; reason?: string }) =>
        withAuth((t, tid) => api.revokeCredential(t, tid, input.id, input.reason)),
      onSuccess: invalidate,
    }),
    expireCredentials: useMutation({
      mutationFn: () => withAuth((t, tid) => api.expireCredentials(t, tid)),
      onSuccess: invalidate,
    }),
    createServiceAccount: useMutation({
      mutationFn: (body: { displayName: string; roleBindings?: string[] }) =>
        withAuth((t, tid) => api.createServiceAccount(t, tid, body)),
      onSuccess: invalidate,
    }),
    disableServiceAccount: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.disableServiceAccount(t, tid, id)),
      onSuccess: invalidate,
    }),
    createSubscription: useMutation({
      mutationFn: (body: Record<string, unknown>) =>
        withAuth((t, tid) => api.createWebhookSubscription(t, tid, body)),
      onSuccess: invalidate,
    }),
    enableSubscription: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.enableWebhookSubscription(t, tid, id)),
      onSuccess: invalidate,
    }),
    disableSubscription: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.disableWebhookSubscription(t, tid, id)),
      onSuccess: invalidate,
    }),
    rotateSecret: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.rotateWebhookSecret(t, tid, id)),
      onSuccess: invalidate,
    }),
    deleteSubscription: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.deleteWebhookSubscription(t, tid, id)),
      onSuccess: invalidate,
    }),
    retryDelivery: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.retryWebhookDelivery(t, tid, id)),
      onSuccess: invalidate,
    }),
    replayDelivery: useMutation({
      mutationFn: (id: string) =>
        withAuth((t, tid) => api.replayWebhookDelivery(t, tid, id)),
      onSuccess: invalidate,
    }),
    resetQuotas: useMutation({
      mutationFn: (keyPrefix?: string) =>
        withAuth((t, tid) => api.resetGatewayQuotas(t, tid, keyPrefix)),
      onSuccess: invalidate,
    }),
  };
}
