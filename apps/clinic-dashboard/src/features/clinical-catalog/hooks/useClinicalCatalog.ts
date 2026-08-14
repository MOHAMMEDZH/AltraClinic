import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createClinicalPriceDraft,
  createTenantClinicalServiceDraft,
  fetchClinicalPriceVersions,
  fetchClinicalServices,
  fetchTenantServiceConfigs,
  publishClinicalPriceVersion,
  publishClinicalService,
  upsertTenantServiceConfig,
  type CreateClinicalPriceDraftInput,
  type CreateTenantClinicalServiceInput,
} from '../api/clinical-catalog-api';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useClinicalServices(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['clinical-catalog', 'services', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchClinicalServices(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useTenantServiceConfigs(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['clinical-catalog', 'configs', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantServiceConfigs(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useCreateTenantClinicalService() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateTenantClinicalServiceInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createTenantClinicalServiceDraft(token, user.tenantId, body);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog'] }),
  });
}

export function usePublishClinicalService() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (serviceId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return publishClinicalService(token, user.tenantId, serviceId);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog'] }),
  });
}

export function useUpsertTenantServiceConfig() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { clinicalServiceId: string; enabled: boolean }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return upsertTenantServiceConfig(token, user.tenantId, body);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog'] }),
  });
}

export function useClinicalPriceVersions(enabled = true, clinicalServiceId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['clinical-catalog', 'prices', clinicalServiceId ?? 'all', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchClinicalPriceVersions(token, user.tenantId, {
        clinicalServiceId,
      });
    },
    staleTime: 30_000,
  });
}

export function useCreateClinicalPriceDraft() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: CreateClinicalPriceDraftInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createClinicalPriceDraft(token, user.tenantId, body);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog', 'prices'] }),
  });
}

export function usePublishClinicalPriceVersion() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (priceVersionId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return publishClinicalPriceVersion(token, user.tenantId, priceVersionId);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog', 'prices'] }),
  });
}
