import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { shouldUseDemoFallback } from '@/lib/demo-fallback';
import {
  archivePatient,
  createPatient,
  createDemoPatientList,
  fetchPatient,
  fetchPatientDuplicates,
  fetchPatients,
  fetchPatientTimeline,
  mergePatients,
  quickRegisterPatient,
  reactivatePatient,
  updatePatient,
} from '../api/patients-api';
import type { CreatePatientPayload, PatientListParams, UpdatePatientPayload } from '../types';
import { PATIENT_PAGE_SIZE } from '../config/patients-config';
import { savePatientListCache, loadPatientListCache } from '../lib/patient-list-cache';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function usePatientsList(params: PatientListParams) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['patients', 'list', ...authKeys(user), params],
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        const result = await fetchPatients(token, user.tenantId, {
          limit: PATIENT_PAGE_SIZE,
          ...params,
        });
        savePatientListCache({
          savedAt: new Date().toISOString(),
          items: result.items,
          total: result.total,
        });
        return result;
      } catch (err) {
        const cached = loadPatientListCache();
        if (cached) return { items: cached.items, total: cached.total };
        if (shouldUseDemoFallback(err, online)) return createDemoPatientList();
        throw err;
      }
    },
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function usePatient(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['patients', 'detail', patientId, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatient(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function usePatientTimeline(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['patients', 'timeline', patientId, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientTimeline(token, user.tenantId, patientId);
    },
    staleTime: 60_000,
  });
}

export function usePatientDuplicates(patientId: string | undefined, enabled = false) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['patients', 'duplicates', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientDuplicates(token, user.tenantId, patientId);
    },
  });
}

export function useCreatePatient() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: CreatePatientPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createPatient(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients', 'list'] });
    },
  });
}

export function useQuickRegisterPatient() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: { firstName: string; lastName: string; phone?: string; gender?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return quickRegisterPatient(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients', 'list'] });
    },
  });
}

export function useUpdatePatient(patientId: string) {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (payload: UpdatePatientPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updatePatient(token, user.tenantId, patientId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients', 'detail', patientId] });
      void qc.invalidateQueries({ queryKey: ['patients', 'list'] });
    },
  });
}

export function useArchivePatient() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (patientId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return archivePatient(token, user.tenantId, patientId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useReactivatePatient() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async (patientId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return reactivatePatient(token, user.tenantId, patientId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useMergePatients() {
  const qc = useQueryClient();
  const { getValidAccessToken, user } = useAuth();

  return useMutation({
    mutationFn: async ({ targetId, sourceId }: { targetId: string; sourceId: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return mergePatients(token, user.tenantId, targetId, sourceId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}
