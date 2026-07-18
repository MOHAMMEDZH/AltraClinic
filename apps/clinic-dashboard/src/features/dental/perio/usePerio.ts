import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/app/providers/AuthProvider';
import {
  comparePerioExams,
  createPerioExam,
  fetchPerioExam,
  fetchPerioExams,
  fetchPerioProgress,
  updatePerioExam,
} from './perio-api';
import type { UpdatePerioExamPayload } from './perio.types';

function authKeys(user: { tenantId?: string } | null) {
  return [user?.tenantId ?? ''] as const;
}

export function usePerioExams(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'perio', 'exams', patientId, ...authKeys(user)],
    enabled: Boolean(patientId && enabled),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPerioExams(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function usePerioExam(examId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'perio', 'exam', examId, ...authKeys(user)],
    enabled: Boolean(examId && enabled),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !examId) throw new Error('Not authenticated');
      return fetchPerioExam(token, user.tenantId, examId);
    },
    staleTime: 15_000,
  });
}

export function usePerioProgress(patientId: string | undefined, enabled = true) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'perio', 'progress', patientId, ...authKeys(user)],
    enabled: Boolean(patientId && enabled),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !patientId) throw new Error('Not authenticated');
      return fetchPerioProgress(token, user.tenantId, patientId);
    },
    staleTime: 30_000,
  });
}

export function useComparePerioExams(
  baselineExamId: string | undefined,
  compareExamId: string | undefined,
  enabled = true,
) {
  const { getValidAccessToken, user } = useAuth();
  return useQuery({
    queryKey: ['dental', 'perio', 'compare', baselineExamId, compareExamId, ...authKeys(user)],
    enabled: Boolean(baselineExamId && compareExamId && enabled),
    queryFn: async () => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId || !baselineExamId || !compareExamId) {
        throw new Error('Not authenticated');
      }
      return comparePerioExams(token, user.tenantId, baselineExamId, compareExamId);
    },
    staleTime: 30_000,
  });
}

export function useCreatePerioExam(patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePerioExamPayload = {}) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return createPerioExam(token, user.tenantId, patientId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'perio', 'exams', patientId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'perio', 'progress', patientId] });
    },
  });
}

export function useUpdatePerioExam(examId: string, patientId: string) {
  const { getValidAccessToken, user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: UpdatePerioExamPayload) => {
      const token = await getValidAccessToken();
      if (!token || !user?.tenantId) throw new Error('Not authenticated');
      return updatePerioExam(token, user.tenantId, examId, payload);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['dental', 'perio', 'exam', examId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'perio', 'exams', patientId] });
      void qc.invalidateQueries({ queryKey: ['dental', 'perio', 'progress', patientId] });
    },
  });
}
