import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  approveTreatmentPlan,
  createTreatmentPlan,
  fetchTreatmentPlan,
  fetchTreatmentPlanAnalytics,
  fetchTreatmentPlans,
  recordTreatmentConsent,
  submitTreatmentPlan,
  updateTreatmentItemStatus,
  updateTreatmentPlan,
} from './treatment-plan-api';
import type { CreateTreatmentPlanPayload, UpdateTreatmentPlanPayload } from './treatment-plan.types';

function authKey(user: { tenantId: string } | null) {
  return user?.tenantId ?? 'none';
}

export function useTreatmentPlans(patientId?: string, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'treatment-plans', authKey(user), patientId],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTreatmentPlans(token, user.tenantId, { patientId });
    },
    staleTime: 15_000,
  });
}

export function useTreatmentPlan(planId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'treatment-plan', authKey(user), planId],
    enabled: enabled && Boolean(planId && user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !planId) throw new Error('Not authenticated');
      return fetchTreatmentPlan(token, user.tenantId, planId);
    },
    staleTime: 10_000,
  });
}

export function useTreatmentPlanAnalytics(enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'treatment-plan-analytics', authKey(user)],
    enabled: enabled && Boolean(user?.tenantId),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return fetchTreatmentPlanAnalytics(token, user.tenantId);
    },
    staleTime: 30_000,
  });
}

export function useCreateTreatmentPlan() {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: CreateTreatmentPlanPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createTreatmentPlan(token, user.tenantId, payload);
    },
    onSuccess: (data) => {
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plans'] });
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plan', user?.tenantId, data.id] });
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plan-analytics'] });
    },
  });
}

export function useUpdateTreatmentPlan(planId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdateTreatmentPlanPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateTreatmentPlan(token, user.tenantId, planId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plans'] });
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plan', user?.tenantId, planId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'treatment-plan-analytics'] });
    },
  });
}

export function useSubmitTreatmentPlan(planId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return submitTreatmentPlan(token, user.tenantId, planId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}

export function useApproveTreatmentPlan(planId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveTreatmentPlan(token, user.tenantId, planId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}

export function useRecordTreatmentConsent(planId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (method?: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return recordTreatmentConsent(token, user.tenantId, planId, method);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}

export function useUpdateTreatmentItemStatus(planId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateTreatmentItemStatus(token, user.tenantId, planId, itemId, status);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental'] });
    },
  });
}
