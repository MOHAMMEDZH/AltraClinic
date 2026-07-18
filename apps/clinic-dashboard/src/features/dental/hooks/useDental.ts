import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { resolveOfflineQueryFallback } from '@/lib/query-fallback';
import {
  consumeDentalMaterial,
  consumeDentalMaterialsBatch,
  createDentalChart,
  createDentalTreatment,
  createDemoDentalChart,
  createDemoDentalMetrics,
  createDemoDentalOverview,
  fetchDentalChart,
  fetchDentalClinicalInventory,
  fetchDentalMetrics,
  fetchDentalOverview,
  fetchDentalProcedureMaterials,
  fetchPatientDentalMaterials,
  updateDentalTeeth,
} from '../api/dental-api';
import type { CreateTreatmentPayload, ToothRecord } from '../types/dental.types';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useDentalChart(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['dental', 'chart', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      try {
        return await fetchDentalChart(token, user.tenantId, patientId);
      } catch (err) {
        if ((err as { status?: number }).status === 404) throw err;
        return resolveOfflineQueryFallback(err, online, () => createDemoDentalChart(patientId));
      }
    },
    staleTime: 15_000,
    retry: false,
  });
}

export function useCreateDentalChart() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (patientId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createDentalChart(token, user.tenantId, patientId);
    },
    onSuccess: (data) => {
      qc.setQueryData(['dental', 'chart', data.patientId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}

export function useUpdateDentalTeeth(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (teeth: ToothRecord[]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateDentalTeeth(token, user.tenantId, patientId, teeth);
    },
    onSuccess: (data) => {
      qc.setQueryData(['dental', 'chart', patientId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['dental', 'metrics'] });
      void qc.invalidateQueries({ queryKey: ['dental', 'overview'] });
    },
  });
}

export function useCreateDentalTreatment() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateTreatmentPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createDentalTreatment(token, user.tenantId, payload);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['dental', 'chart', vars.patientId] });
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}

export function useDentalMetrics(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['dental', 'metrics', ...authKeys(user)],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchDentalMetrics(token, user.tenantId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoDentalMetrics);
      }
    },
    staleTime: 30_000,
  });
}

export function useDentalOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['dental', 'overview', ...authKeys(user)],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchDentalOverview(token, user.tenantId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoDentalOverview);
      }
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
}

export function useDentalProcedureMaterials(procedureCode: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'procedure-materials', procedureCode, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && procedureCode.trim().length > 0,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchDentalProcedureMaterials(token, user.tenantId, procedureCode.trim());
    },
    staleTime: 30_000,
  });
}

export function usePatientDentalMaterials(patientId: string | undefined, procedureCode?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'materials', patientId, procedureCode ?? '', ...authKeys(user)],
    enabled: Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientDentalMaterials(token, user.tenantId, patientId, procedureCode);
    },
    staleTime: 10_000,
  });
}

export function useDentalClinicalInventorySearch(q: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'clinical-inventory', q, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && q.trim().length >= 1,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchDentalClinicalInventory(token, user.tenantId, q.trim());
    },
    staleTime: 15_000,
  });
}

export function useConsumeDentalMaterial(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemId: string; quantity: number; procedureCode?: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return consumeDentalMaterial(token, user.tenantId, patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'materials', patientId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useConsumeDentalMaterialsBatch(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      procedureCode?: string;
      notes?: string;
      items: { itemId: string; quantity: number }[];
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return consumeDentalMaterialsBatch(token, user.tenantId, patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'materials', patientId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
