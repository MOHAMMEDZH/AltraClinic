import { apiRequest } from '@/lib/api-client';
import type { BeautyAnnotation } from '../types/beauty.types';

export interface BeautyPatientSummary {
  patientId: string;
  patientName?: string;
  hasRecord: boolean;
  recordId?: string;
  activePlans?: number;
  sessionCount?: number;
  upcomingSessions?: number;
  followUpDue?: number;
  skincareRegimens?: number;
  invoiceCount?: number;
  annotationCount?: number;
  lastUpdated?: string;
  activePlan?: { id: string; title: string; status: string; estimatedCost?: number } | null;
}

export interface BeautyTimelineEntry {
  id: string;
  type: string;
  title: string;
  subtitle: string | null;
  occurredAt: string;
  metadata?: Record<string, unknown>;
}

export async function fetchBeautyPatientSummary(
  token: string,
  tenantId: string,
  patientId: string,
): Promise<BeautyPatientSummary> {
  return apiRequest(`/beauty/patients/${patientId}/summary`, { token, tenantId });
}

export async function fetchBeautyTimeline(
  token: string,
  tenantId: string,
  patientId: string,
  limit = 50,
): Promise<BeautyTimelineEntry[]> {
  return apiRequest(`/beauty/patients/${patientId}/timeline?limit=${limit}`, { token, tenantId });
}

export async function updateBeautyAnnotation(
  token: string,
  tenantId: string,
  annotationId: string,
  body: Partial<{ zone: string; treatment: string; parameters: Record<string, unknown>; notes: string | null }>,
): Promise<BeautyAnnotation> {
  return apiRequest(`/beauty/annotations/${annotationId}`, { method: 'PATCH', body, token, tenantId });
}

export async function deleteBeautyAnnotation(
  token: string,
  tenantId: string,
  annotationId: string,
): Promise<{ deleted: boolean }> {
  return apiRequest(`/beauty/annotations/${annotationId}/delete`, { method: 'POST', token, tenantId });
}

export async function approveBeautyPlan(
  token: string,
  tenantId: string,
  patientId: string,
  planId: string,
): Promise<unknown> {
  return apiRequest(`/beauty/record/${patientId}/plans/${planId}/approve`, { method: 'POST', token, tenantId });
}

export async function exportBeautyRecord(token: string, tenantId: string, patientId: string): Promise<unknown> {
  return apiRequest(`/beauty/patients/${patientId}/export`, { token, tenantId });
}
