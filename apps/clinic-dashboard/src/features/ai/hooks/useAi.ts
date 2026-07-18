import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createAiModel,
  deployAiModel,
  fetchAiAdminOverview,
  fetchAiAdminUsage,
  fetchAiAdminProviders,
  updateAiAdminProviders,
  fetchAiModel,
  fetchAiModels,
  retireAiModel,
  validateAiModel,
  type CreateAiModelBody,
  type ListAiModelsParams,
  type AiTenantProviderSettings,
} from '../api/ai-api';

const ROOT = ['ai'] as const;

export function useAiAdminUsage(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'admin', 'usage', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiAdminUsage(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useAiAdminOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'admin', 'overview', user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiAdminOverview(token, user.tenantId);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 60_000,
  });
}

export function useUpdateAiAdminProviders() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Partial<AiTenantProviderSettings>) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateAiAdminProviders(token, user.tenantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: [...ROOT, 'admin'] });
      void qc.invalidateQueries({ queryKey: [...ROOT, 'overview'] });
    },
  });
}

export function useAiModels(params?: ListAiModelsParams, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'models', user?.tenantId, params],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchAiModels(token, user.tenantId, params);
    },
    enabled: Boolean(user?.tenantId) && enabled,
    staleTime: 30_000,
  });
}

export function useAiModel(modelId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: [...ROOT, 'model', modelId, user?.tenantId],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !modelId) throw new Error('Not authenticated');
      return fetchAiModel(token, user.tenantId, modelId);
    },
    enabled: Boolean(user?.tenantId && modelId) && enabled,
  });
}

export function useCreateAiModel() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateAiModelBody) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createAiModel(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'models'] }),
  });
}

export function useValidateAiModel() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ modelId, notes }: { modelId: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return validateAiModel(token, user.tenantId, modelId, notes);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'models'] }),
  });
}

export function useDeployAiModel() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deployAiModel(token, user.tenantId, modelId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'models'] }),
  });
}

export function useRetireAiModel() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (modelId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return retireAiModel(token, user.tenantId, modelId);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: [...ROOT, 'models'] }),
  });
}
