import type { DashboardRange } from '../api/dashboard-api';
import { isDashboardRange } from './dashboard-range';

export type DashboardWidgetCategory = 'all' | 'operations' | 'finance' | 'clinical' | 'inventory' | 'platform';

const CATEGORY_VALUES: DashboardWidgetCategory[] = [
  'all',
  'operations',
  'finance',
  'clinical',
  'inventory',
  'platform',
];

export function parseDashboardRangeParam(raw: string | null): DashboardRange {
  if (raw && isDashboardRange(raw)) return raw;
  return '7d';
}

export function parseDashboardCategoryParam(raw: string | null): DashboardWidgetCategory {
  if (raw && CATEGORY_VALUES.includes(raw as DashboardWidgetCategory)) {
    return raw as DashboardWidgetCategory;
  }
  return 'all';
}

/** Parse branch from URL: `all` → null (tenant-wide), otherwise branch UUID. */
export function parseDashboardBranchParam(raw: string | null): string | null {
  if (!raw || raw === 'all') return null;
  return raw;
}

export function buildDashboardUrl(
  range: DashboardRange,
  branchId: string | null,
  category: DashboardWidgetCategory = 'all',
): string {
  const params = new URLSearchParams();
  if (range !== '7d') params.set('range', range);
  if (branchId) params.set('branchId', branchId);
  else params.set('branchId', 'all');
  if (category !== 'all') params.set('category', category);
  const qs = params.toString();
  return qs ? `/?${qs}` : '/';
}

function withQuery(path: string, query: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

export const dashboardDrillDown = {
  patients: () => '/patients',
  appointmentsToday: (branchId?: string | null) =>
    withQuery('/appointments', { branchId: branchId ?? undefined }),
  appointmentsByProvider: (providerId: string, branchId?: string | null) =>
    withQuery('/appointments', {
      providerId,
      branchId: branchId ?? undefined,
      view: 'list',
    }),
  appointmentsByStatus: (status: string, branchId?: string | null) =>
    withQuery('/appointments', {
      status,
      branchId: branchId ?? undefined,
      view: 'list',
    }),
  appointmentSelected: (appointmentId: string) =>
    withQuery('/appointments', { selected: appointmentId }),
  appointmentTrends: (branchId?: string | null) =>
    withQuery('/appointments', { view: 'list', branchId: branchId ?? undefined }),
  queue: () => '/queue',
  billing: () => '/billing',
  billingOutstanding: () => '/billing/outstanding',
  encountersPending: () => withQuery('/encounters', { filter: 'pending' }),
  inventoryLowStock: () => withQuery('/inventory/catalog', { stock: 'low' }),
  inventoryItem: (itemId: string) => `/inventory/items/${itemId}`,
  inventoryDashboard: () => '/inventory',
  patient: (patientId: string) => `/patients/${patientId}`,
  reports: (metric?: string, range?: DashboardRange) =>
    withQuery('/reports', {
      metric: metric ?? undefined,
      range: range && range !== '7d' ? range : undefined,
    }),
  branchDashboard: (branchId: string, range: DashboardRange) => buildDashboardUrl(range, branchId),
  analytics: (
    metric?: 'revenue' | 'appointments' | 'patients' | 'health' | 'all',
    range?: DashboardRange,
    branchId?: string | null,
  ) =>
    withQuery('/analytics', {
      metric: metric && metric !== 'all' ? metric : undefined,
      range: range && range !== '7d' ? range : undefined,
      branchId: branchId ?? undefined,
    }),
};
