import { apiRequest } from '@/lib/api-client';
import type {
  CreateTreatmentPlanPayload,
  TreatmentPlanAnalytics,
  TreatmentPlanDetail,
  TreatmentPlanSummary,
  UpdateTreatmentPlanPayload,
} from './treatment-plan.types';

export async function fetchTreatmentPlans(
  token: string,
  tenantId: string,
  params: { patientId?: string; status?: string } = {},
): Promise<{ items: TreatmentPlanSummary[] }> {
  const sp = new URLSearchParams();
  if (params.patientId) sp.set('patientId', params.patientId);
  if (params.status) sp.set('status', params.status);
  const q = sp.toString();
  return apiRequest(`/dental/treatment-plans${q ? `?${q}` : ''}`, { token, tenantId });
}

export async function fetchTreatmentPlan(
  token: string,
  tenantId: string,
  planId: string,
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}`, { token, tenantId });
}

export async function createTreatmentPlan(
  token: string,
  tenantId: string,
  payload: CreateTreatmentPlanPayload,
): Promise<TreatmentPlanDetail> {
  return apiRequest('/dental/treatment-plans', {
    method: 'POST',
    token,
    tenantId,
    body: payload,
  });
}

export async function updateTreatmentPlan(
  token: string,
  tenantId: string,
  planId: string,
  payload: UpdateTreatmentPlanPayload,
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}`, {
    method: 'PATCH',
    token,
    tenantId,
    body: payload,
  });
}

export async function submitTreatmentPlan(
  token: string,
  tenantId: string,
  planId: string,
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}/submit`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function approveTreatmentPlan(
  token: string,
  tenantId: string,
  planId: string,
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}/approve`, {
    method: 'POST',
    token,
    tenantId,
  });
}

export async function recordTreatmentConsent(
  token: string,
  tenantId: string,
  planId: string,
  method = 'in_clinic',
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}/consent`, {
    method: 'POST',
    token,
    tenantId,
    body: { method },
  });
}

export async function updateTreatmentItemStatus(
  token: string,
  tenantId: string,
  planId: string,
  itemId: string,
  status: string,
): Promise<TreatmentPlanDetail> {
  return apiRequest(`/dental/treatment-plans/${planId}/items/${itemId}/status`, {
    method: 'PATCH',
    token,
    tenantId,
    body: { status },
  });
}

export async function fetchTreatmentPlanAnalytics(
  token: string,
  tenantId: string,
): Promise<TreatmentPlanAnalytics> {
  return apiRequest('/dental/treatment-plans/analytics', { token, tenantId });
}
