/**
 * Release 47 Step 10 — Maps metric definitions + resolution outcomes into the
 * safe response DTO. This is the boundary that guarantees no raw Prisma data,
 * identifiers, or free text ever reaches the client.
 */
import type {
  DashboardSectionDto,
  MetricAvailability,
  MetricDto,
  PlatformDashboardDto,
} from '../dto/platform-dashboard.dto';
import type { MetricDefinition } from '../metric-registry';
import { SECTION_ORDER } from '../metric-registry';
import type { MetricBreakdownValue } from '../resolvers/resolver.types';

function baseMetric(def: MetricDefinition) {
  return {
    id: def.id,
    section: def.section,
    labelKey: def.labelKey,
    descriptionKey: def.descriptionKey,
    unit: def.unit,
    sourceKey: def.sourceKey,
    sourceLabelKey: def.sourceLabelKey,
    definitionKey: def.definitionKey,
    timeWindow: def.timeWindow,
    availability: def.availability,
    quality: def.quality,
    requiredPermissions: def.requiredPermissions,
    scope: 'platform' as const,
  };
}

function mapBreakdown(breakdown?: MetricBreakdownValue[]) {
  return breakdown?.map((item) => ({
    key: item.key,
    labelKey: item.labelKey,
    count: item.count,
  }));
}

/** Caller lacks a required permission — never resolved, never a number. */
export function buildPermissionLimitedMetric(def: MetricDefinition): MetricDto {
  return {
    ...baseMetric(def),
    value: null,
    status: 'permission_limited',
    asOf: null,
    staleAfterSeconds: 0,
    isStale: false,
  };
}

/** No Source of Record exists. Unavailable is NEVER rendered as zero. */
export function buildUnavailableMetric(def: MetricDefinition): MetricDto {
  return {
    ...baseMetric(def),
    value: null,
    status: 'unavailable',
    asOf: null,
    staleAfterSeconds: 0,
    isStale: false,
    reasonCode: def.reasonCode,
  };
}

/** Resolver threw — isolated failure. Other metrics are unaffected. */
export function buildDegradedMetric(def: MetricDefinition): MetricDto {
  return {
    ...baseMetric(def),
    value: null,
    status: 'degraded',
    asOf: null,
    staleAfterSeconds: 0,
    isStale: false,
  };
}

export interface ResolvedMetricInput {
  readonly value: number | null;
  readonly breakdown?: MetricBreakdownValue[];
  readonly asOf: string;
  readonly isStale: boolean;
  readonly staleAfterSeconds: number;
}

export function buildResolvedMetric(
  def: MetricDefinition,
  resolved: ResolvedMetricInput,
): MetricDto {
  const isEmpty = resolved.value === 0 || resolved.value === null;
  const status = resolved.isStale ? 'stale' : isEmpty ? 'empty' : 'available';
  return {
    ...baseMetric(def),
    value: resolved.value,
    status,
    asOf: resolved.asOf,
    staleAfterSeconds: resolved.staleAfterSeconds,
    isStale: resolved.isStale,
    breakdown: mapBreakdown(resolved.breakdown),
  };
}

function sectionAvailability(metrics: MetricDto[]): MetricAvailability {
  if (metrics.some((m) => m.availability === 'available')) return 'available';
  if (metrics.some((m) => m.availability === 'available_legacy')) return 'available_legacy';
  return 'unavailable';
}

export function assembleDashboard(
  metrics: MetricDto[],
  options: { generatedAt: string; warnings: string[] },
): PlatformDashboardDto {
  const sections: DashboardSectionDto[] = SECTION_ORDER.map((id) => {
    const sectionMetrics = metrics.filter((metric) => metric.section === id);
    return {
      id,
      availability: sectionAvailability(sectionMetrics),
      metrics: sectionMetrics,
    };
  }).filter((section) => section.metrics.length > 0);

  return {
    generatedAt: options.generatedAt,
    sections,
    metrics,
    attentionItems: [],
    warnings: options.warnings,
  };
}
