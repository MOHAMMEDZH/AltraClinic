/**
 * Release 47 Step 10 — Client-side mirror of the safe Platform Dashboard DTO.
 * Kept structurally identical to the API contract; carries only i18n keys,
 * aggregate counts, and safe reason codes — never PHI or free text.
 */

export type MetricSectionId = 'footprint' | 'commercial' | 'operations' | 'sales';

export type MetricStatus =
  | 'available'
  | 'empty'
  | 'stale'
  | 'degraded'
  | 'unavailable'
  | 'permission_limited';

export type MetricAvailability = 'available' | 'available_legacy' | 'unavailable';

export type MetricQuality = 'exact' | 'legacy' | 'none';

export interface MetricBreakdown {
  key: string;
  labelKey: string;
  count: number;
}

export interface DashboardMetric {
  id: string;
  section: MetricSectionId;
  labelKey: string;
  descriptionKey: string;
  value: number | null;
  unit: string;
  status: MetricStatus;
  asOf: string | null;
  sourceKey: string;
  sourceLabelKey: string;
  definitionKey: string;
  timeWindow: string;
  staleAfterSeconds: number;
  isStale: boolean;
  availability: MetricAvailability;
  quality: MetricQuality;
  requiredPermissions: string[];
  scope: 'platform';
  breakdown?: MetricBreakdown[];
  reasonCode?: string;
}

export interface DashboardSection {
  id: MetricSectionId;
  availability: MetricAvailability;
  metrics: DashboardMetric[];
}

export interface PlatformDashboard {
  generatedAt: string;
  sections: DashboardSection[];
  metrics: DashboardMetric[];
  attentionItems: never[];
  warnings: string[];
}
