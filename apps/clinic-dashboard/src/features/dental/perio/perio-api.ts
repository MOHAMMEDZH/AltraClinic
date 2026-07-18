import { apiRequest } from '@/lib/api-client';
import type {
  PerioCompareResult,
  PerioExamDetail,
  PerioExamSummary,
  PerioProgress,
  UpdatePerioExamPayload,
} from './perio.types';

export async function fetchPerioExams(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<{ items: PerioExamSummary[] }> {
  return apiRequest(`/dental/perio/${patientId}/exams`, { token, tenantId });
}

export async function fetchPerioExam(
  token: string,
  tenantId: string,
  examId: string,
): Promise<PerioExamDetail> {
  return apiRequest(`/dental/perio/exams/${examId}`, { token, tenantId });
}

export async function createPerioExam(
  token: string,
  tenantId: string,
  patientId: string,
  payload: UpdatePerioExamPayload = {},
): Promise<PerioExamDetail> {
  return apiRequest(`/dental/perio/${patientId}/exams`, {
    method: 'POST',
    body: payload,
    token,
    tenantId,
  });
}

export async function updatePerioExam(
  token: string,
  tenantId: string,
  examId: string,
  payload: UpdatePerioExamPayload,
): Promise<PerioExamDetail> {
  return apiRequest(`/dental/perio/exams/${examId}`, {
    method: 'PATCH',
    body: payload,
    token,
    tenantId,
  });
}

export async function fetchPerioProgress(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<PerioProgress> {
  return apiRequest(`/dental/perio/${patientId}/progress`, { token, tenantId });
}

export async function comparePerioExams(
  token: string,
  tenantId: string,
  baselineExamId: string,
  compareExamId: string,
): Promise<PerioCompareResult> {
  return apiRequest(
    `/dental/perio/exams/compare?baselineExamId=${encodeURIComponent(baselineExamId)}&compareExamId=${encodeURIComponent(compareExamId)}`,
    { token, tenantId },
  );
}
