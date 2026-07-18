import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  archiveSettingsBranch,
  createApiKey,
  createSettingsBranch,
  fetchApiKeys,
  fetchBillingSequences,
  fetchIdentityFeatures,
  fetchSettingsBranches,
  fetchSettingsOverview,
  fetchTenantSettings,
  revokeApiKey,
  updateBillingSequences,
  updateSettingsBranch,
  updateTenantSettings,
} from '../api/settings-api';

export function useSettingsOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'overview', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchSettingsOverview(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useTenantSettings(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'tenant', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantSettings(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useSettingsBranches(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'branches', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchSettingsBranches(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function useBillingSequences(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'billing-sequences', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBillingSequences(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function useApiKeys(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'api-keys', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchApiKeys(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useIdentityFeatures(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['settings', 'features', user?.tenantId],
    enabled: Boolean(user?.tenantId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchIdentityFeatures(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

function useSettingsMutation<TArgs, TResult>(
  mutationFn: (token: string, tenantId: string, args: TArgs) => Promise<TResult>,
) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: TArgs) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return mutationFn(token, user.tenantId, args);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['settings'] });
      void qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTenantSettings() {
  return useSettingsMutation((token, tenantId, body: Record<string, unknown>) =>
    updateTenantSettings(token, tenantId, body),
  );
}

export function useCreateBranch() {
  return useSettingsMutation((token, tenantId, body: Record<string, unknown>) =>
    createSettingsBranch(token, tenantId, body),
  );
}

export function useUpdateBranch() {
  return useSettingsMutation(
    (token, tenantId, args: { branchId: string; body: Record<string, unknown> }) =>
      updateSettingsBranch(token, tenantId, args.branchId, args.body),
  );
}

export function useArchiveBranch() {
  return useSettingsMutation((token, tenantId, branchId: string) =>
    archiveSettingsBranch(token, tenantId, branchId),
  );
}

export function useUpdateBillingSequences() {
  return useSettingsMutation(
    (token, tenantId, sequences: Array<{ prefix: string; lastNumber?: number }>) =>
      updateBillingSequences(token, tenantId, sequences),
  );
}

export function useCreateApiKey() {
  return useSettingsMutation((token, tenantId, name: string) => createApiKey(token, tenantId, name));
}

export function useRevokeApiKey() {
  return useSettingsMutation((token, tenantId, keyId: string) => revokeApiKey(token, tenantId, keyId));
}
