import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createClinicalPriceDraft,
  createTenantClinicalServiceDraft,
  fetchClinicalPriceVersions,
  fetchClinicalServices,
  fetchTenantServiceConfigs,
  inactivateClinicalPriceVersion,
  publishClinicalPriceVersion,
  publishClinicalService,
  replaceScheduledClinicalPriceVersion,
  upsertTenantServiceConfig,
  type ClinicalCatalogListScope,
  type CreateClinicalPriceDraftInput,
  type CreateTenantClinicalServiceInput,
  type UpsertTenantServiceConfigInput,
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

export function useTenantServiceConfigs(
  enabled = true,
  query: { scope: ClinicalCatalogListScope; branchId?: string | null } = { scope: 'all' },
) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey =
    query.scope === 'branch' ? query.branchId ?? 'missing-branch' : query.scope;
  return useQuery({
    queryKey: ['clinical-catalog', 'configs', query.scope, branchKey, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && (query.scope !== 'branch' || Boolean(query.branchId)),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTenantServiceConfigs(token, user.tenantId, {
        scope: query.scope,
        branchId: query.branchId,
      });
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
    mutationFn: async (body: UpsertTenantServiceConfigInput) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return upsertTenantServiceConfig(token, user.tenantId, body);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog'] }),
  });
}

export function useClinicalPriceVersions(
  enabled = true,
  query: {
    clinicalServiceId?: string;
    scope: ClinicalCatalogListScope;
    branchId?: string | null;
  } = { scope: 'tenant' },
) {
  const { getValidAccessToken, user } = useAuth();
  const branchKey =
    query.scope === 'branch' ? query.branchId ?? 'missing-branch' : query.scope;
  return useQuery({
    queryKey: [
      'clinical-catalog',
      'prices',
      query.scope,
      branchKey,
      query.clinicalServiceId ?? 'all-services',
      ...authKeys(user),
    ],
    enabled:
      enabled &&
      Boolean(user?.tenantId) &&
      (query.scope !== 'branch' || Boolean(query.branchId)),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchClinicalPriceVersions(token, user.tenantId, {
        clinicalServiceId: query.clinicalServiceId,
        scope: query.scope,
        branchId: query.branchId,
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

export function useInactivateClinicalPriceVersion() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (priceVersionId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return inactivateClinicalPriceVersion(token, user.tenantId, priceVersionId);
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog', 'prices'] }),
  });
}

export function useReplaceScheduledClinicalPriceVersion() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      canceledScheduleId: string;
      replacement: CreateClinicalPriceDraftInput;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      const draft = await createClinicalPriceDraft(token, user.tenantId, input.replacement);
      return replaceScheduledClinicalPriceVersion(
        token,
        user.tenantId,
        input.canceledScheduleId,
        draft.id,
      );
    },
    onSuccess: () =>
      void qc.invalidateQueries({ queryKey: ['clinical-catalog', 'prices'] }),
  });
}
