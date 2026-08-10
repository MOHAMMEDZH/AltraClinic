/**
 * Release 47 Step 10 — Safe response DTOs for the Platform Dashboard MVP.
 *
 * These types are the *only* shape that ever leaves the controller. They carry
 * i18n key references (never localized copy), aggregate counts, and safe
 * reason codes — never raw Prisma rows, tenant identifiers, free text, or PHI.
 */

export type MetricSectionId = 'footprint' | 'commercial' | 'operations' | 'sales';

/**
 * Per-metric status:
 *  - available          resolved with data
 *  - empty              resolved, but the true aggregate is zero (≠ unavailable)
 *  - stale              served from cache older than the stale threshold
 *  - degraded           resolver failed in isolation; other metrics unaffected
 *  - unavailable        no Source of Record exists (carries a reasonCode)
 *  - permission_limited caller lacks the permission to view this metric
 */
export type MetricStatus =
  | 'available'
  | 'empty'
  | 'stale'
  | 'degraded'
  | 'unavailable'
  | 'permission_limited';

/** Coarse availability classification, mirrored on both metric and section. */
export type MetricAvailability = 'available' | 'available_legacy' | 'unavailable';

/** Data-quality signal for consumers — separate from availability. */
export type MetricQuality = 'exact' | 'legacy' | 'none';

export interface MetricBreakdownDto {
  /** Stable machine key (e.g. `ACTIVE`, `LITE`, `medical`). Never free text. */
  readonly key: string;
  readonly labelKey: string;
  readonly count: number;
}

export interface MetricDto {
  readonly id: string;
  readonly section: MetricSectionId;
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly value: number | null;
  readonly unit: string;
  readonly status: MetricStatus;
  readonly asOf: string | null;
  readonly sourceKey: string;
  readonly sourceLabelKey: string;
  readonly definitionKey: string;
  readonly timeWindow: string;
  readonly staleAfterSeconds: number;
  readonly isStale: boolean;
  readonly availability: MetricAvailability;
  readonly quality: MetricQuality;
  readonly requiredPermissions: readonly string[];
  readonly scope: 'platform';
  readonly breakdown?: MetricBreakdownDto[];
  readonly reasonCode?: string;
}

export interface DashboardSectionDto {
  readonly id: MetricSectionId;
  readonly availability: MetricAvailability;
  readonly metrics: MetricDto[];
}

export interface PlatformDashboardDto {
  readonly generatedAt: string;
  readonly sections: DashboardSectionDto[];
  /** Flat mirror of every section's metrics — convenience for clients. */
  readonly metrics: MetricDto[];
  /** Always empty in the MVP — no conflict/override Source of Record exists. */
  readonly attentionItems: never[];
  /** Safe machine codes only (e.g. `partial_degraded`). Never raw errors. */
  readonly warnings: string[];
}
