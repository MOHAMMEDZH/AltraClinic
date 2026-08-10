import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import { useOnlineStatus } from '@/features/auth/hooks/useOnlineStatus';
import { resolveOfflineQueryFallback } from '@/lib/query-fallback';
import {
  appendVitals,
  clinicalSearch,
  completeEncounter,
  createDemoDashboard,
  createDemoEmrMetrics,
  createDemoEncounterDetail,
  createDemoEncounters,
  createEncounter,
  createPatientProblem,
  consumeEncounterMaterial,
  fetchClinicalInventoryItems,
  fetchEmrDashboard,
  fetchEmrMetrics,
  fetchEncounter,
  fetchEncounterAudit,
  fetchEncounterMaterials,
  fetchEncounters,
  fetchPatientProblems,
  fetchPrescriptionHistory,
  resolvePatientProblem,
  signEncounter,
  updateEncounter,
  updateSoapNotes,
  fetchNoteTemplates,
  createNoteTemplate,
  deleteNoteTemplate,
  fetchLabResults,
  createLabResult,
  fetchTreatmentPlans,
  fetchEncounterBilling,
  updateStructuredNotes,
  recordMedicationRefill,
  coSignEncounter,
  createTreatmentPlan,
  updateTreatmentPlanItemStatus,
} from '../api/emr-api';
import type {
  CreateEncounterPayload,
  ListEncountersParams,
  SoapNotes,
  StructuredClinicalNote,
  UpdateEncounterPayload,
} from '../types/emr.types';
import { EMR_PAGE_SIZE } from '../config/emr-config';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useEncountersList(params: ListEncountersParams, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['emr', 'encounters', ...authKeys(user), params],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchEncounters(token, user.tenantId, {
          limit: EMR_PAGE_SIZE,
          ...params,
        });
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoEncounters);
      }
    },
    staleTime: 20_000,
    placeholderData: (prev) => prev,
  });
}

export function useEncounter(encounterId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['emr', 'encounter', encounterId, ...authKeys(user)],
    enabled: Boolean(encounterId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !encounterId) throw new Error('Not authenticated');
      try {
        return await fetchEncounter(token, user.tenantId, encounterId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, () => createDemoEncounterDetail(encounterId));
      }
    },
    staleTime: 15_000,
  });
}

export function useEmrMetrics(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['emr', 'metrics', ...authKeys(user)],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchEmrMetrics(token, user.tenantId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoEmrMetrics);
      }
    },
    staleTime: 30_000,
  });
}

export function useEmrDashboard(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  const online = useOnlineStatus();

  return useQuery({
    queryKey: ['emr', 'dashboard', ...authKeys(user)],
    enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      try {
        return await fetchEmrDashboard(token, user.tenantId);
      } catch (err) {
        return resolveOfflineQueryFallback(err, online, createDemoDashboard);
      }
    },
    staleTime: 30_000,
  });
}

export function useClinicalSearch(q: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['emr', 'search', q, ...authKeys(user)],
    enabled: enabled && q.trim().length >= 2,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return clinicalSearch(token, user.tenantId, q.trim());
    },
    staleTime: 15_000,
  });
}

export function useCreateEncounter() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: CreateEncounterPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createEncounter(token, user.tenantId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emr'] });
      void qc.invalidateQueries({ queryKey: ['patients'] });
    },
  });
}

export function useUpdateEncounter(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: UpdateEncounterPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateEncounter(token, user.tenantId, encounterId, payload);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['emr', 'encounters'] });
      void qc.invalidateQueries({ queryKey: ['emr', 'metrics'] });
      void qc.invalidateQueries({ queryKey: ['emr', 'dashboard'] });
    },
  });
}

export function useCompleteEncounter(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return completeEncounter(token, user.tenantId, encounterId);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['emr'] });
    },
  });
}

export function useSignEncounter(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return signEncounter(token, user.tenantId, encounterId);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['emr'] });
    },
  });
}

export function useUpdateSoapNotes(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (soap: SoapNotes) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateSoapNotes(token, user.tenantId, encounterId, soap);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['emr', 'encounter', encounterId, 'audit'] });
    },
  });
}

export function useAppendVitals(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (observations: { type: string; value: string; unit?: string }[]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return appendVitals(token, user.tenantId, encounterId, observations);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
      void qc.invalidateQueries({ queryKey: ['emr', 'encounter', encounterId, 'audit'] });
    },
  });
}

export function useEncounterAudit(encounterId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['emr', 'encounter', encounterId, 'audit', ...authKeys(user)],
    enabled: Boolean(encounterId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !encounterId) throw new Error('Not authenticated');
      return fetchEncounterAudit(token, user.tenantId, encounterId);
    },
    staleTime: 10_000,
  });
}

export function usePrescriptionHistory(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['emr', 'rx-history', patientId, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPrescriptionHistory(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function usePatientProblems(patientId: string | undefined, status?: string) {
  const { getValidAccessToken, user } = useAuth();

  return useQuery({
    queryKey: ['emr', 'problems', patientId, status, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPatientProblems(token, user.tenantId, patientId, status);
    },
    staleTime: 20_000,
  });
}

export function useCreatePatientProblem(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (body: { description: string; code?: string; onsetDate?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createPatientProblem(token, user.tenantId, patientId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emr', 'problems', patientId] });
    },
  });
}

export function useResolvePatientProblem(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (problemId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return resolvePatientProblem(token, user.tenantId, problemId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emr', 'problems', patientId] });
    },
  });
}

export function useEncounterMaterials(encounterId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'materials', encounterId, ...authKeys(user)],
    enabled: enabled && Boolean(encounterId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !encounterId) throw new Error('Not authenticated');
      return fetchEncounterMaterials(token, user.tenantId, encounterId);
    },
    staleTime: 10_000,
  });
}

export function useClinicalInventorySearch(q: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'clinical-inventory', q, ...authKeys(user)],
    enabled: enabled && Boolean(user?.tenantId) && q.trim().length >= 1,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchClinicalInventoryItems(token, user.tenantId, q.trim());
    },
    staleTime: 15_000,
  });
}

export function useConsumeEncounterMaterial(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { itemId: string; quantity: number; notes?: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return consumeEncounterMaterial(token, user.tenantId, encounterId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['emr', 'materials', encounterId] });
      void qc.invalidateQueries({ queryKey: ['inventory'] });
    },
  });
}

export function useNoteTemplates() {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'note-templates', ...authKeys(user)],
    enabled: Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchNoteTemplates(token, user.tenantId);
    },
    staleTime: 60_000,
  });
}

export function useCreateNoteTemplate() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: { name: string; noteType: string; soapNotes?: SoapNotes; body?: string | null }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createNoteTemplate(token, user.tenantId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['emr', 'note-templates'] }),
  });
}

export function useDeleteNoteTemplate() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteNoteTemplate(token, user.tenantId, id);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['emr', 'note-templates'] }),
  });
}

export function useLabResults(patientId: string | undefined, encounterId?: string) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'labs', patientId, encounterId, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchLabResults(token, user.tenantId, patientId, encounterId);
    },
    staleTime: 20_000,
  });
}

export function useCreateLabResult(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createLabResult>[3]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createLabResult(token, user.tenantId, patientId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['emr', 'labs', patientId] }),
  });
}

export function useTreatmentPlans(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'treatment-plans', patientId, ...authKeys(user)],
    enabled: Boolean(patientId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchTreatmentPlans(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function useEncounterBilling(encounterId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['emr', 'billing', encounterId, ...authKeys(user)],
    enabled: Boolean(encounterId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !encounterId) throw new Error('Not authenticated');
      return fetchEncounterBilling(token, user.tenantId, encounterId);
    },
    staleTime: 20_000,
  });
}

export function useUpdateStructuredNotes(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (notes: StructuredClinicalNote[]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateStructuredNotes(token, user.tenantId, encounterId, notes);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
    },
  });
}

export function useRecordMedicationRefill(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (medicationIndex: number) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return recordMedicationRefill(token, user.tenantId, encounterId, medicationIndex);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
    },
  });
}

export function useCoSignEncounter(encounterId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return coSignEncounter(token, user.tenantId, encounterId);
    },
    onSuccess: (data) => {
      qc.setQueryData(['emr', 'encounter', encounterId, ...authKeys(user)], data);
    },
  });
}

export function useCreateTreatmentPlan(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: {
      title: string;
      clinicalNotes?: string | null;
      items?: Array<{ code: string; description: string; estimatedCost?: number }>;
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createTreatmentPlan(token, user.tenantId, patientId, body);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['emr', 'treatment-plans', patientId] }),
  });
}

export function useUpdateTreatmentPlanItemStatus(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { planId: string; itemId: string; status: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateTreatmentPlanItemStatus(token, user.tenantId, input.planId, input.itemId, input.status);
    },
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['emr', 'treatment-plans', patientId] }),
  });
}
