import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  approveBeautyPlan,
  deleteBeautyAnnotation,
  fetchBeautyPatientSummary,
  fetchBeautyTimeline,
  updateBeautyAnnotation,
} from '../api/beauty-extended-api';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? 'none'] as const;
}

export function useBeautyPatientSummary(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'summary', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchBeautyPatientSummary(token, user.tenantId, patientId);
    },
  });
}

export function useBeautyTimeline(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['beauty', 'timeline', patientId, ...authKeys(user)],
    enabled: Boolean(patientId) && enabled,
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchBeautyTimeline(token, user.tenantId, patientId);
    },
  });
}

export function useUpdateBeautyAnnotation(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      annotationId,
      body,
    }: {
      annotationId: string;
      body: Parameters<typeof updateBeautyAnnotation>[3];
    }) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updateBeautyAnnotation(token, user.tenantId, annotationId, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'record', patientId] });
    },
  });
}

export function useDeleteBeautyAnnotation(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (annotationId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return deleteBeautyAnnotation(token, user.tenantId, annotationId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'record', patientId] });
    },
  });
}

export function useApproveBeautyPlan(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (planId: string) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return approveBeautyPlan(token, user.tenantId, patientId, planId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['beauty', 'record', patientId] });
      void qc.invalidateQueries({ queryKey: ['beauty', 'summary', patientId] });
    },
  });
}
