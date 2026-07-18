import { apiRequest, API_BASE, ApiError } from '@/lib/api-client';
import type {
  DashboardCustomRange,
  DashboardOverview,
  DashboardRange,
} from '@/features/dashboard/api/dashboard-api';
import { buildDashboardRangeQuery } from '@/features/dashboard/lib/dashboard-range';
import type { AnalyticsDomainId } from '../config/analytics-catalog';

export type AnalyticsKpiFormat = 'currency' | 'number' | 'percent' | 'text' | 'duration';

export interface AnalyticsKpi {
  id: string;
  labelKey: string;
  value: number | string;
  format: AnalyticsKpiFormat;
  href?: string;
}

export type AnalyticsChartType = 'bar' | 'line' | 'area' | 'pie' | 'donut' | 'gauge' | 'heatmap' | 'stackedBar' | 'scatter' | 'funnel';

export interface AnalyticsChartSeries {
  id: string;
  type: AnalyticsChartType;
  titleKey: string;
  data: unknown;
}

export interface AnalyticsTable {
  id: string;
  titleKey: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface AnalyticsBenchmark {
  id: string;
  labelKey: string;
  current: number;
  previous: number;
  unit: 'currency' | 'number' | 'percent';
}

export interface AnalyticsDomainOverview {
  domainId: string;
  generatedAt: string;
  kpis: AnalyticsKpi[];
  charts: AnalyticsChartSeries[];
  tables: AnalyticsTable[];
  benchmarks?: AnalyticsBenchmark[];
}

export interface AnalyticsAlert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  titleKey: string;
  messageKey: string;
  domainId?: string;
  metricId?: string;
  value?: number;
  threshold?: number;
}

export interface AnalyticsFilterPreset {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AnalyticsLayout {
  version: number;
  widgetOrder: string[];
  hiddenWidgets: string[];
  gridLayout?: Array<{ i: string; x: number; y: number; w: number; h: number }>;
}

export interface AnalyticsDashboardSummary {
  dashboardId: string;
  name: string;
  description?: string;
  dashboardType: string;
  isDefault: boolean;
  isPublic: boolean;
  widgetCount: number;
}

function buildAnalyticsQuery(
  branchId?: string | null,
  range: DashboardRange = '30d',
  customRange?: DashboardCustomRange,
): string {
  const params = new URLSearchParams();
  const rangeQuery =
    range === 'custom' && customRange
      ? buildDashboardRangeQuery(range, customRange)
      : buildDashboardRangeQuery(range, { from: '', to: '' });
  for (const [key, value] of Object.entries(rangeQuery)) {
    params.set(key, value);
  }
  if (branchId === null) params.set('branchId', 'all');
  else if (branchId) params.set('branchId', branchId);
  return params.toString();
}

export async function fetchAnalyticsDomain(
  token: string,
  domainId: AnalyticsDomainId,
  tenantId: string,
  branchId?: string | null,
  range: DashboardRange = '30d',
  customRange?: DashboardCustomRange,
): Promise<AnalyticsDomainOverview> {
  const qs = buildAnalyticsQuery(branchId, range, customRange);
  return apiRequest<AnalyticsDomainOverview>(`/analytics/domains/${domainId}?${qs}`, { token, tenantId });
}

export async function fetchAnalyticsAlerts(
  token: string,
  tenantId: string,
  branchId?: string | null,
  range: DashboardRange = '30d',
  customRange?: DashboardCustomRange,
): Promise<AnalyticsAlert[]> {
  const qs = buildAnalyticsQuery(branchId, range, customRange);
  const body = await apiRequest<{ alerts: AnalyticsAlert[] }>(`/analytics/alerts?${qs}`, { token, tenantId });
  return body.alerts;
}

export async function fetchAnalyticsFilterPresets(
  token: string,
  tenantId: string,
): Promise<AnalyticsFilterPreset[]> {
  const body = await apiRequest<{ presets: AnalyticsFilterPreset[] }>('/analytics/filter-presets', {
    token,
    tenantId,
  });
  return body.presets;
}

export async function createAnalyticsFilterPreset(
  token: string,
  tenantId: string,
  name: string,
  filters: Record<string, unknown>,
): Promise<AnalyticsFilterPreset> {
  return apiRequest('/analytics/filter-presets', {
    method: 'POST',
    body: { name, filters },
    token,
    tenantId,
  });
}

export async function deleteAnalyticsFilterPreset(
  token: string,
  presetId: string,
  tenantId: string,
): Promise<void> {
  await apiRequest(`/analytics/filter-presets/${presetId}`, { method: 'DELETE', token, tenantId });
}

export async function fetchAnalyticsLayout(
  token: string,
  tenantId: string,
  profile = 'default',
): Promise<AnalyticsLayout | null> {
  const body = await apiRequest<{ layout: AnalyticsLayout | null }>(
    `/analytics/layout?profile=${encodeURIComponent(profile)}`,
    { token, tenantId },
  );
  return body.layout;
}

export async function saveAnalyticsLayout(
  token: string,
  tenantId: string,
  layout: Omit<AnalyticsLayout, 'version'> & { profile?: string },
): Promise<AnalyticsLayout> {
  return apiRequest('/analytics/layout', {
    method: 'PUT',
    body: layout,
    token,
    tenantId,
  });
}

export async function fetchAnalyticsDashboards(
  token: string,
  tenantId: string,
): Promise<AnalyticsDashboardSummary[]> {
  const body = await apiRequest<{ dashboards: AnalyticsDashboardSummary[] }>('/analytics/dashboards', {
    token,
    tenantId,
  });
  return body.dashboards ?? [];
}

export async function createAnalyticsDashboard(
  token: string,
  tenantId: string,
  input: {
    name: string;
    dashboardType: string;
    description?: string;
    widgets: Array<{
      metricName: string;
      title: string;
      chartType: string;
      size: string;
    }>;
    isPublic?: boolean;
  },
): Promise<{ dashboardId: string }> {
  return apiRequest('/analytics/dashboards', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export interface AnalyticsReportSummary {
  reportId: string;
  name: string;
  description?: string;
  reportType: string;
  format: string;
  status: string;
  createdAt: string;
  completedAt: string | null;
  rowCount: number;
  isScheduled: boolean;
}

export async function fetchAnalyticsOverview(
  token: string,
  branchId: string | null | undefined,
  tenantId?: string | null,
  range: DashboardRange = '7d',
  customRange?: DashboardCustomRange,
): Promise<DashboardOverview> {
  const params = new URLSearchParams({ range });
  if (range === 'custom' && customRange) {
    params.set('from', customRange.from);
    params.set('to', customRange.to);
  }
  if (branchId === null) {
    params.set('branchId', 'all');
  } else if (branchId) {
    params.set('branchId', branchId);
  }
  return apiRequest<DashboardOverview>(`/analytics/overview?${params}`, { token, tenantId });
}

export async function fetchAnalyticsReports(
  token: string,
  tenantId?: string | null,
  branchId?: string | null,
): Promise<AnalyticsReportSummary[]> {
  const params = new URLSearchParams();
  if (branchId) params.set('branchId', branchId);
  const qs = params.toString();
  const body = await apiRequest<{ reports: AnalyticsReportSummary[] }>(
    `/analytics/reports${qs ? `?${qs}` : ''}`,
    { token, tenantId },
  );
  return body.reports;
}

export interface AnalyticsReportDetail extends AnalyticsReportSummary {
  description?: string;
  branchId?: string;
  parameters?: Record<string, unknown>;
  recipientEmails?: string[];
  scheduleFrequency?: string;
  lastScheduledRunAt?: string | null;
  downloadUrl?: string | null;
}

export async function fetchAnalyticsReportDetail(
  token: string,
  reportId: string,
  tenantId?: string | null,
): Promise<AnalyticsReportDetail> {
  return apiRequest<AnalyticsReportDetail>(`/analytics/reports/${reportId}`, { token, tenantId });
}

export interface GenerateAnalyticsReportInput {
  name: string;
  reportType: 'operational' | 'clinical' | 'financial' | 'inventory' | 'executive' | 'custom';
  format: 'pdf' | 'excel' | 'csv' | 'json';
  description?: string;
  branchId?: string;
  parameters?: Record<string, unknown>;
  isScheduled?: boolean;
  scheduleFrequency?: 'daily' | 'weekly' | 'monthly';
  recipientEmails?: string[];
}

export async function generateAnalyticsReport(
  token: string,
  input: GenerateAnalyticsReportInput,
  tenantId?: string | null,
): Promise<{ reportId: string; status: string }> {
  return apiRequest('/analytics/reports', {
    method: 'POST',
    body: input,
    token,
    tenantId,
  });
}

export async function downloadAnalyticsReport(
  token: string,
  reportId: string,
  filename: string,
  tenantId?: string | null,
): Promise<void> {
  const headers = new Headers();
  headers.set('Accept', 'application/octet-stream');
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (tenantId) headers.set('x-tenant-id', tenantId);

  const response = await fetch(`${API_BASE}/analytics/reports/${reportId}/download`, { headers });
  if (!response.ok) {
    const text = await response.text();
    let body: unknown;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    const message =
      typeof body === 'object' && body !== null && 'message' in body
        ? String((body as { message: unknown }).message)
        : response.statusText;
    throw new ApiError(message, response.status, body);
  }

  const blob = await response.blob();
  const { triggerBrowserDownload } = await import('@/lib/download-file');
  triggerBrowserDownload(blob, filename);
}
