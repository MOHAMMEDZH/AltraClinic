/**
 * Phase 45e — Dashboard domain (OD-DASHBOARD).
 * Read-only operational views; no analytics/BI.
 */

export type DashboardScope = 'platform' | 'tenant' | 'shared';

export type DashboardCategory =
  | 'summary'
  | 'health'
  | 'metrics'
  | 'logging'
  | 'tracing'
  | 'queue'
  | 'jobs'
  | 'database'
  | 'cache'
  | 'export_storage'
  | 'tenant'
  | 'platform';

export interface DashboardDescriptor {
  id: string;
  title: string;
  description: string;
  category: DashboardCategory;
  scope: DashboardScope;
  /** Deep-link path hints for Settings ops hub / hub Health pages. */
  deepLinks: readonly string[];
  requiresSubFlag?:
    | 'alerting'
    | 'tenantDashboard'
    | 'metrics'
    | 'logging'
    | 'tracing';
  schemaVersion: '45e';
}

export interface DashboardPanel {
  id: string;
  title: string;
  kind: 'stat' | 'list' | 'status' | 'series_summary';
  /** PHI-safe operational values only. */
  data: Record<string, string | number | boolean | null>;
}

export interface DashboardSnapshot {
  dashboardId: string;
  title: string;
  scope: DashboardScope;
  tenantId: string | null;
  generatedAt: string;
  dormant: boolean;
  panels: readonly DashboardPanel[];
  deepLinks: readonly string[];
  schemaVersion: '45e';
}

export interface DashboardQueryInput {
  dashboardId: string;
  tenantId: string | null;
  includeOtherTenants?: boolean;
}
