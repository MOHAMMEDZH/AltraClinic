import { API_BASE } from '@/lib/api-client';
import { apiRequest } from '@/lib/api-client';
import {
  downloadAnalyticsReport,
  fetchAnalyticsReports,
  fetchAnalyticsReportDetail,
  generateAnalyticsReport,
  type AnalyticsReportDetail,
  type AnalyticsReportSummary,
  type GenerateAnalyticsReportInput,
} from '@/features/analytics/api/analytics-api';

export type { AnalyticsReportSummary, AnalyticsReportDetail, GenerateAnalyticsReportInput };

export interface OperationalReportSummary {
  reportId: string;
  name: string;
  type: string;
  status: string;
  format: string;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
}

export interface ReportShareRecord {
  id: string;
  reportId: string;
  reportKind: string;
  targetType: string;
  targetId: string;
  access: string;
  createdBy: string;
  createdAt: string;
}

export interface ReportFilterPresetRecord {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ReportCustomDefinitionRecord {
  id: string;
  name: string;
  reportType: string;
  format: string;
  visualization: string;
  dataset: string;
  dimensions: string[];
  measures: string[];
  filters: Record<string, unknown>;
  isScheduled: boolean;
  scheduleFrequency: string | null;
  recipientEmails: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReportAuditRecord {
  id: string;
  action: string;
  actorId: string;
  createdAt: string;
  descriptionEn: string | null;
  descriptionAr: string | null;
  details: unknown;
}

export async function fetchOperationalReports(
  token: string,
  tenantId: string,
  params?: { type?: string; status?: string },
): Promise<OperationalReportSummary[]> {
  const qs = new URLSearchParams();
  if (params?.type) qs.set('type', params.type);
  if (params?.status) qs.set('status', params.status);
  const suffix = qs.toString() ? `?${qs.toString()}` : '';
  const body = await apiRequest<{ reports: unknown[] } | unknown[]>(`/reporting/reports${suffix}`, { token, tenantId });
  const rows = Array.isArray(body) ? body : (body.reports ?? []);
  return (rows ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    return {
      reportId: String(r.reportId ?? r.id ?? ''),
      name: String(r.name ?? r.type ?? 'Report'),
      type: String(r.type ?? ''),
      status: String(r.status ?? ''),
      format: String(r.format ?? ''),
      createdAt: String(r.createdAt ?? ''),
      completedAt: r.completedAt != null ? String(r.completedAt) : null,
      downloadUrl: r.downloadUrl != null ? String(r.downloadUrl) : null,
    };
  });
}

export async function requestOperationalReport(
  token: string,
  tenantId: string,
  body: {
    type: string;
    format: string;
    name?: string;
    createdBy?: string;
    branchId?: string;
    startDate?: string;
    endDate?: string;
  },
): Promise<{ reportId: string }> {
  const startDate = body.startDate ?? new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  const endDate = body.endDate ?? new Date().toISOString().slice(0, 10);
  return apiRequest('/reporting/reports', {
    method: 'POST',
    token,
    tenantId,
    body: {
      type: body.type,
      format: body.format,
      name: body.name ?? body.type,
      createdBy: body.createdBy,
      startDate,
      endDate,
      branchId: body.branchId,
    },
  });
}

export async function downloadOperationalReport(
  token: string,
  reportId: string,
  filename: string,
  tenantId?: string | null,
): Promise<void> {
  const headers = new Headers();
  headers.set('Accept', 'application/octet-stream');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (tenantId) headers.set('x-tenant-id', tenantId);

  const response = await fetch(`${API_BASE}/reporting/reports/${reportId}/download`, { headers });
  if (!response.ok) {
    throw new Error('Download failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export async function fetchReportShares(
  token: string,
  tenantId: string,
  reportId: string,
): Promise<ReportShareRecord[]> {
  const body = await apiRequest<{ shares: ReportShareRecord[] }>(
    `/reporting/reports/${reportId}/shares`,
    { token, tenantId },
  );
  return body.shares ?? [];
}

export async function createReportShare(
  token: string,
  tenantId: string,
  reportId: string,
  body: { targetType: string; targetId: string; access: string; reportKind?: string },
): Promise<ReportShareRecord> {
  const res = await apiRequest<{ share: ReportShareRecord }>(
    `/reporting/reports/${reportId}/shares`,
    { method: 'POST', token, tenantId, body },
  );
  return res.share;
}

export async function fetchReportFilterPresets(
  token: string,
  tenantId: string,
): Promise<ReportFilterPresetRecord[]> {
  const body = await apiRequest<{ presets: ReportFilterPresetRecord[] }>(
    '/reporting/filter-presets',
    { token, tenantId },
  );
  return body.presets ?? [];
}

export async function saveReportFilterPreset(
  token: string,
  tenantId: string,
  body: { id?: string; name: string; filters: Record<string, unknown> },
): Promise<ReportFilterPresetRecord> {
  const res = await apiRequest<{ preset: ReportFilterPresetRecord }>(
    '/reporting/filter-presets',
    { method: 'POST', token, tenantId, body },
  );
  return res.preset;
}

export async function deleteReportFilterPreset(
  token: string,
  tenantId: string,
  presetId: string,
): Promise<void> {
  await apiRequest(`/reporting/filter-presets/${presetId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchReportCustomDefinitions(
  token: string,
  tenantId: string,
): Promise<ReportCustomDefinitionRecord[]> {
  const body = await apiRequest<{ definitions: ReportCustomDefinitionRecord[] }>(
    '/reporting/custom-definitions',
    { token, tenantId },
  );
  return body.definitions ?? [];
}

export async function saveReportCustomDefinition(
  token: string,
  tenantId: string,
  body: Omit<ReportCustomDefinitionRecord, 'createdAt' | 'updatedAt'> & { id?: string },
): Promise<ReportCustomDefinitionRecord> {
  const res = await apiRequest<{ definition: ReportCustomDefinitionRecord }>(
    '/reporting/custom-definitions',
    { method: 'POST', token, tenantId, body },
  );
  return res.definition;
}

export async function deleteReportCustomDefinition(
  token: string,
  tenantId: string,
  definitionId: string,
): Promise<void> {
  await apiRequest(`/reporting/custom-definitions/${definitionId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchReportAudit(
  token: string,
  tenantId: string,
  reportId: string,
): Promise<ReportAuditRecord[]> {
  const body = await apiRequest<{ entries: ReportAuditRecord[] }>(
    `/reporting/reports/${reportId}/audit`,
    { token, tenantId },
  );
  return body.entries ?? [];
}

export async function recordReportAudit(
  token: string,
  tenantId: string,
  reportId: string,
  action: string,
  details?: Record<string, unknown>,
): Promise<void> {
  await apiRequest(`/reporting/reports/${reportId}/audit`, {
    method: 'POST',
    token,
    tenantId,
    body: { action, details },
  });
}

export interface OperationalReportDetail {
  reportId: string;
  name: string;
  type: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  downloadUrl: string | null;
  createdBy: string;
  kind: 'operational';
}

export async function fetchOperationalReportDetail(
  token: string,
  tenantId: string,
  reportId: string,
): Promise<OperationalReportDetail> {
  return apiRequest(`/reporting/reports/${reportId}`, { token, tenantId });
}

export async function fetchRecentReportActivity(
  token: string,
  tenantId: string,
  limit = 20,
): Promise<Array<{ id: string; reportId: string; action: string; actorId: string; createdAt: string }>> {
  const body = await apiRequest<{ entries: Array<{ id: string; reportId: string; action: string; actorId: string; createdAt: string }> }>(
    `/reporting/activity?limit=${limit}`,
    { token, tenantId },
  );
  return body.entries ?? [];
}

export async function updateAnalyticsReportSchedule(
  token: string,
  tenantId: string,
  reportId: string,
  body: {
    isScheduled?: boolean;
    scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
    recipientEmails?: string[];
    name?: string;
  },
): Promise<AnalyticsReportDetail> {
  return apiRequest(`/analytics/reports/${reportId}`, { method: 'PATCH', token, tenantId, body });
}

export async function deleteAnalyticsReport(
  token: string,
  tenantId: string,
  reportId: string,
): Promise<void> {
  await apiRequest(`/analytics/reports/${reportId}`, { method: 'DELETE', token, tenantId });
}

export {
  fetchAnalyticsReports,
  fetchAnalyticsReportDetail,
  generateAnalyticsReport,
  downloadAnalyticsReport,
};
