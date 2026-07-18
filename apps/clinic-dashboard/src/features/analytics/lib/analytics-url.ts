import type { DashboardRange } from '@/features/dashboard/api/dashboard-api';

export type AnalyticsMetric = 'all' | 'revenue' | 'appointments' | 'patients' | 'health';

const METRICS: AnalyticsMetric[] = ['all', 'revenue', 'appointments', 'patients', 'health'];

export function parseAnalyticsMetric(raw: string | null): AnalyticsMetric {
  if (raw && METRICS.includes(raw as AnalyticsMetric)) return raw as AnalyticsMetric;
  return 'all';
}

export function metricShowsSection(
  metric: AnalyticsMetric,
  section: Exclude<AnalyticsMetric, 'all'>,
): boolean {
  return metric === 'all' || metric === section;
}

export function buildAnalyticsUrl(
  range: DashboardRange,
  branchId: string | null,
  metric: AnalyticsMetric,
): string {
  const params = new URLSearchParams();
  if (range !== '7d') params.set('range', range);
  if (branchId) params.set('branchId', branchId);
  else params.set('branchId', 'all');
  if (metric !== 'all') params.set('metric', metric);
  const qs = params.toString();
  return qs ? `/analytics?${qs}` : '/analytics';
}
