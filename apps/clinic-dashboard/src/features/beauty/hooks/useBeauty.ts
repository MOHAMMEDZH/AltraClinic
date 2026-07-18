import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import {
  addBeautyAnnotation,
  consumeBeautyMaterial,
  consumeBeautyMaterialsBatch,
  createBeautyRecord,
  createDemoBeautyMetrics,
  createDemoBeautyOverview,
  createDemoBeautyRecord,
  createDemoBeautyAnalytics,
  fetchBeautyAnalytics,
  fetchBeautyClinicalInventory,
  fetchBeautyMetrics,
  fetchBeautyOverview,
  fetchBeautyProcedureMaterials,
  fetchBeautyRecord,
  fetchPatientBeautyMaterials,
  updateBeautyRecord,
  withNormalizedRecord,
} from '../api/beauty-api';
import type { BeautyBodyMapState, CreateAnnotationPayload } from '../types/beauty.types';
import { shouldUseBeautyDemoFallback } from '../api/beauty-query-utils';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useBeautyMetrics(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['beauty', 'metrics', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchBeautyMetrics(token, user.tenantId);
      } catch (err) {
        if (!shouldUseBeautyDemoFallback(err, online)) throw err;
        return createDemoBeautyMetrics();
      }
    },
    staleTime: 60_000,
  });
}

export function useBeautyOverview(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['beauty', 'overview', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchBeautyOverview(token, user.tenantId);
      } catch (err) {
        if (!shouldUseBeautyDemoFallback(err, online)) throw err;
        return createDemoBeautyOverview();
      }
    },
    staleTime: 30_000,
  });
}

export function useBeautyRecord(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['beauty', 'record', patientId, ...authKeys(user)],
    enabled: enabled && Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      try {
        const record = await fetchBeautyRecord(token, user.tenantId, patientId);
        if (!record) return null;
        return withNormalizedRecord(record);
      } catch (err) {
        const status = (err as { status?: number })?.status;
        if (status === 404) return null;
        if (!shouldUseBeautyDemoFallback(err, online)) throw err;
        return withNormalizedRecord(createDemoBeautyRecord(patientId));
      }
    },
    staleTime: 15_000,
  });
}

export function useCreateBeautyRecord() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patientId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createBeautyRecord(token, user.tenantId, patientId);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'overview'] });
      void qc.invalidateQueries({ queryKey: ['beauty', 'record', data.patientId] });
    },
  });
}

export function useUpdateBeautyRecord(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (bodyMapState: BeautyBodyMapState) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateBeautyRecord(token, user.tenantId, patientId, bodyMapState as unknown as Record<string, unknown>);
    },
    onSuccess: (data) => {
      qc.setQueryData(['beauty', 'record', patientId, ...authKeys(user)], withNormalizedRecord(data));
      void qc.invalidateQueries({ queryKey: ['beauty', 'overview'] });
      void qc.invalidateQueries({ queryKey: ['beauty', 'metrics'] });
    },
  });
}

export function useAddBeautyAnnotation(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateAnnotationPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return addBeautyAnnotation(token, user.tenantId, patientId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'record', patientId] });
    },
  });
}

export function useBeautyAnalytics(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();
  return useQuery({
    queryKey: ['beauty', 'analytics', ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchBeautyAnalytics(token, user.tenantId);
      } catch (err) {
        if (!shouldUseBeautyDemoFallback(err, online)) throw err;
        return createDemoBeautyAnalytics();
      }
    },
    staleTime: 60_000,
  });
}

export function useBeautyProcedureMaterials(procedureCode: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'procedure-materials', procedureCode, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && procedureCode.trim().length > 0,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBeautyProcedureMaterials(token, user.tenantId, procedureCode.trim());
    },
    staleTime: 30_000,
  });
}

export function usePatientBeautyMaterials(patientId: string | undefined, procedureCode?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'materials', patientId, procedureCode ?? '', ...authKeys(user)],
    enabled: Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientBeautyMaterials(token, user.tenantId, patientId, procedureCode);
    },
    staleTime: 10_000,
  });
}

export function useBeautyClinicalInventorySearch(q: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'clinical-inventory', q, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && q.trim().length >= 1,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchBeautyClinicalInventory(token, user.tenantId, q.trim());
    },
    staleTime: 15_000,
  });
}

export function useConsumeBeautyMaterial(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemId: string; quantity: number; procedureCode?: string; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return consumeBeautyMaterial(token, user.tenantId, patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'materials', patientId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useConsumeBeautyMaterialsBatch(patientId: string) {
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
      return consumeBeautyMaterialsBatch(token, user.tenantId, patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'materials', patientId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}
