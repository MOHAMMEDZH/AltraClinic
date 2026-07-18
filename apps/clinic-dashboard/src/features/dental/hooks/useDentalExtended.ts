import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  createDentalClinicalNote,
  createImplantRecord,
  createOrthodonticCase,
  createTreatmentPlanInvoice,
  fetchDentalClinicalNotes,
  fetchDentalPatientSummary,
  fetchDentalTimeline,
  fetchImplantRecords,
  fetchOrthodonticCases,
  updateImplantRecord,
  updateOdontogramMode,
  updateOrthodonticCase,
} from '../api/dental-extended-api';
import type { OdontogramMode } from '../types/dental.types';

function authKeys(user: { tenantId: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useDentalPatientSummary(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'summary', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchDentalPatientSummary(token, user.tenantId, patientId);
    },
    staleTime: 20_000,
  });
}

export function useDentalTimeline(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'timeline', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchDentalTimeline(token, user.tenantId, patientId);
    },
    staleTime: 15_000,
  });
}

export function useUpdateOdontogramMode(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (mode: OdontogramMode) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateOdontogramMode(token, user.tenantId, patientId, mode);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'chart', patientId] });
    },
  });
}

export function useOrthodonticCases(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'ortho', patientId, ...authKeys(user)],
    enabled: Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchOrthodonticCases(token, user.tenantId, patientId);
    },
  });
}

export function useCreateOrthodonticCase() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createOrthodonticCase>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createOrthodonticCase(token, user.tenantId, body);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['dental', 'ortho', vars.patientId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'summary', vars.patientId] });
    },
  });
}

export function useUpdateOrthodonticCase(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ caseId, body }: { caseId: string; body: Parameters<typeof updateOrthodonticCase>[3] }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateOrthodonticCase(token, user.tenantId, caseId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'ortho', patientId] });
    },
  });
}

export function useImplantRecords(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'implants', patientId, ...authKeys(user)],
    enabled: Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchImplantRecords(token, user.tenantId, patientId);
    },
  });
}

export function useCreateImplantRecord() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createImplantRecord>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createImplantRecord(token, user.tenantId, body);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['dental', 'implants', vars.patientId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'summary', vars.patientId] });
    },
  });
}

export function useUpdateImplantRecord(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ implantId, body }: { implantId: string; body: Parameters<typeof updateImplantRecord>[3] }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateImplantRecord(token, user.tenantId, implantId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'implants', patientId] });
    },
  });
}

export function useDentalClinicalNotes(patientId: string | undefined) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'notes', patientId, ...authKeys(user)],
    enabled: Boolean(patientId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchDentalClinicalNotes(token, user.tenantId, patientId);
    },
  });
}

export function useCreateDentalClinicalNote() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (body: Parameters<typeof createDentalClinicalNote>[2]) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createDentalClinicalNote(token, user.tenantId, body);
    },
    onSuccess: (_, vars) => {
      void qc.invalidateQueries({ queryKey: ['dental', 'notes', vars.patientId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'timeline', vars.patientId] });
    },
  });
}

export function useCreateTreatmentPlanInvoice() {
  const { getValidAccessToken, user } = useAuth();
  return useMutation({
    mutationFn: async (planId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createTreatmentPlanInvoice(token, user.tenantId, planId);
    },
  });
}
