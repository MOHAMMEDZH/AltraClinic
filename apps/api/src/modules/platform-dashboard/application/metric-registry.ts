/**
 * Release 47 Step 10 — Code-governed Platform Dashboard metric registry.
 *
 * This is the single Source of Record for *which* metrics exist, their
 * governance (required permissions), their data provenance, and — for metrics
 * with no backing Source of Record — the reason they are `unavailable`.
 *
 * Frozen Source Matrix rules enforced here:
 *  - AVAILABLE metrics map to a resolver key and real Prisma aggregates.
 *  - Legacy metrics are explicitly labeled `available_legacy` and NEVER named
 *    "plan version".
 *  - UNAVAILABLE metrics still appear in the registry (and API) with an
 *    explicit `reasonCode`. Unavailable is never rendered as zero.
 *
 * NOTHING in this file performs Step 11+ domain management. It only describes
 * read-only aggregate reporting.
 */
import type {
  MetricAvailability,
  MetricQuality,
  MetricSectionId,
} from './dto/platform-dashboard.dto';

/** Keys for the resolvers that hit the database. Unavailable metrics have none. */
export type MetricResolverKey =
  | 'tenant.total'
  | 'tenant.byStatus'
  | 'tenant.trialing'
  | 'subscription.byStatus'
  | 'legacyPlan.assignment'
  | 'facilityType.distribution';

export interface MetricDefinition {
  readonly id: string;
  readonly section: MetricSectionId;
  readonly availability: MetricAvailability;
  readonly quality: MetricQuality;
  readonly unit: string;
  /** Snapshot / rolling window descriptor surfaced to the client verbatim. */
  readonly timeWindow: string;
  /** Permissions the caller must hold (all of them) to see real data. */
  readonly requiredPermissions: readonly string[];
  /** i18n key stems — the client owns localized copy. */
  readonly labelKey: string;
  readonly descriptionKey: string;
  readonly definitionKey: string;
  readonly sourceKey: string;
  readonly sourceLabelKey: string;
  /** Present only for AVAILABLE/legacy metrics that resolve real aggregates. */
  readonly resolverKey?: MetricResolverKey;
  /** Present only for UNAVAILABLE metrics. Stable, safe machine code. */
  readonly reasonCode?: string;
  /** Whether a breakdown array is expected when resolved. */
  readonly hasBreakdown?: boolean;
}

function labelKeys(id: string) {
  const base = `dashboard.metrics.${id}`;
  return {
    labelKey: `${base}.label`,
    descriptionKey: `${base}.description`,
    definitionKey: `${base}.definition`,
  };
}

export const PLATFORM_DASHBOARD_METRICS: readonly MetricDefinition[] = [
  // ── FOOTPRINT ──────────────────────────────────────────────────────────────
  {
    id: 'tenant.total',
    section: 'footprint',
    availability: 'available',
    quality: 'exact',
    unit: 'tenants',
    timeWindow: 'snapshot',
    requiredPermissions: ['tenant.view'],
    ...labelKeys('tenant.total'),
    sourceKey: 'platform_tenants',
    sourceLabelKey: 'dashboard.sources.platformTenants',
    resolverKey: 'tenant.total',
  },
  {
    id: 'tenant.byStatus',
    section: 'footprint',
    availability: 'available',
    quality: 'exact',
    unit: 'tenants',
    timeWindow: 'snapshot',
    requiredPermissions: ['tenant.view'],
    ...labelKeys('tenant.byStatus'),
    sourceKey: 'platform_tenants',
    sourceLabelKey: 'dashboard.sources.platformTenants',
    resolverKey: 'tenant.byStatus',
    hasBreakdown: true,
  },
  {
    id: 'tenant.trialing',
    section: 'footprint',
    availability: 'available',
    quality: 'exact',
    unit: 'tenants',
    timeWindow: 'snapshot_now',
    requiredPermissions: ['tenant.view'],
    ...labelKeys('tenant.trialing'),
    sourceKey: 'platform_tenants',
    sourceLabelKey: 'dashboard.sources.platformTenants',
    resolverKey: 'tenant.trialing',
  },
  {
    // Legacy tier assignment — deliberately NOT a plan version.
    id: 'legacyPlan.assignment',
    section: 'footprint',
    availability: 'available_legacy',
    quality: 'legacy',
    unit: 'tenants',
    timeWindow: 'snapshot',
    requiredPermissions: ['plan.view'],
    ...labelKeys('legacyPlan.assignment'),
    sourceKey: 'platform_tenants.plan',
    sourceLabelKey: 'dashboard.sources.legacyPlan',
    resolverKey: 'legacyPlan.assignment',
    hasBreakdown: true,
  },
  {
    id: 'facilityType.distribution',
    section: 'footprint',
    availability: 'available_legacy',
    quality: 'legacy',
    unit: 'tenants',
    timeWindow: 'snapshot',
    requiredPermissions: ['tenant.view'],
    ...labelKeys('facilityType.distribution'),
    sourceKey: 'tenants.features.clinicProfile.clinicType',
    sourceLabelKey: 'dashboard.sources.facilityTypeLegacy',
    resolverKey: 'facilityType.distribution',
    hasBreakdown: true,
  },
  {
    id: 'planVersion.distribution',
    section: 'footprint',
    availability: 'unavailable',
    quality: 'none',
    unit: 'tenants',
    timeWindow: 'none',
    requiredPermissions: ['plan-version.view'],
    ...labelKeys('planVersion.distribution'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_plan_version_source',
  },
  {
    id: 'specialty.distribution',
    section: 'footprint',
    availability: 'unavailable',
    quality: 'none',
    unit: 'tenants',
    timeWindow: 'none',
    requiredPermissions: ['specialty.view'],
    ...labelKeys('specialty.distribution'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'free_text_specialty_unsafe',
  },

  // ── COMMERCIAL ───────────────────────────────────────────────────────────────
  {
    id: 'subscription.byStatus',
    section: 'commercial',
    availability: 'available',
    quality: 'exact',
    unit: 'subscriptions',
    timeWindow: 'snapshot',
    requiredPermissions: ['subscription.view'],
    ...labelKeys('subscription.byStatus'),
    sourceKey: 'platform_subscriptions',
    sourceLabelKey: 'dashboard.sources.platformSubscriptions',
    resolverKey: 'subscription.byStatus',
    hasBreakdown: true,
  },
  {
    id: 'addon.summary',
    section: 'commercial',
    availability: 'unavailable',
    quality: 'none',
    unit: 'addons',
    timeWindow: 'none',
    requiredPermissions: ['addon.view'],
    ...labelKeys('addon.summary'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_addon_source',
  },
  {
    id: 'override.summary',
    section: 'commercial',
    availability: 'unavailable',
    quality: 'none',
    unit: 'overrides',
    timeWindow: 'none',
    requiredPermissions: ['override.view'],
    ...labelKeys('override.summary'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_override_source',
  },
  {
    id: 'override.expiring',
    section: 'commercial',
    availability: 'unavailable',
    quality: 'none',
    unit: 'overrides',
    timeWindow: 'none',
    requiredPermissions: ['override.view'],
    ...labelKeys('override.expiring'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_override_source',
  },
  {
    id: 'entitlement.conflicts',
    section: 'commercial',
    availability: 'unavailable',
    quality: 'none',
    unit: 'conflicts',
    timeWindow: 'none',
    requiredPermissions: ['entitlement.view'],
    ...labelKeys('entitlement.conflicts'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_conflict_source',
  },
  {
    id: 'limit.utilization',
    section: 'commercial',
    availability: 'unavailable',
    quality: 'none',
    unit: 'percent',
    timeWindow: 'none',
    requiredPermissions: ['limit.view'],
    ...labelKeys('limit.utilization'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_aggregate_usage_source',
  },

  // ── OPERATIONS ───────────────────────────────────────────────────────────────
  {
    id: 'operations.health',
    section: 'operations',
    availability: 'unavailable',
    quality: 'none',
    unit: 'status',
    timeWindow: 'none',
    requiredPermissions: ['operations.view'],
    ...labelKeys('operations.health'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'health_adapter_deferred',
  },
  {
    id: 'backup.summary',
    section: 'operations',
    availability: 'unavailable',
    quality: 'none',
    unit: 'backups',
    timeWindow: 'none',
    requiredPermissions: ['operations.view'],
    ...labelKeys('backup.summary'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'backup_not_platform_jwt_boundary',
  },
  {
    id: 'incidents.open',
    section: 'operations',
    availability: 'unavailable',
    quality: 'none',
    unit: 'incidents',
    timeWindow: 'none',
    requiredPermissions: ['operations.view'],
    ...labelKeys('incidents.open'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'incidents_in_process_tenant_scoped',
  },
  {
    id: 'audit.preview',
    section: 'operations',
    availability: 'unavailable',
    quality: 'none',
    unit: 'events',
    timeWindow: 'none',
    requiredPermissions: ['audit.view'],
    ...labelKeys('audit.preview'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_platform_audit_summary',
  },

  // ── SALES ────────────────────────────────────────────────────────────────────
  {
    id: 'sales.summary',
    section: 'sales',
    availability: 'unavailable',
    quality: 'none',
    unit: 'leads',
    timeWindow: 'none',
    requiredPermissions: ['sales-report.view'],
    ...labelKeys('sales.summary'),
    sourceKey: 'none',
    sourceLabelKey: 'dashboard.sources.none',
    reasonCode: 'no_sales_source',
  },
];

export const SECTION_ORDER: readonly MetricSectionId[] = [
  'footprint',
  'commercial',
  'operations',
  'sales',
];

/** Fail-closed invariants — invoked at module load and asserted in tests. */
export function assertMetricRegistryIntegrity(): void {
  const ids = new Set<string>();
  for (const metric of PLATFORM_DASHBOARD_METRICS) {
    if (ids.has(metric.id)) {
      throw new Error(`Duplicate dashboard metric id: ${metric.id}`);
    }
    ids.add(metric.id);

    if (!SECTION_ORDER.includes(metric.section)) {
      throw new Error(`Metric ${metric.id} references unknown section ${metric.section}`);
    }
    if (metric.requiredPermissions.length === 0) {
      throw new Error(`Metric ${metric.id} must declare at least one required permission`);
    }
    if (metric.availability === 'unavailable') {
      if (!metric.reasonCode) {
        throw new Error(`Unavailable metric ${metric.id} must carry a reasonCode`);
      }
      if (metric.resolverKey) {
        throw new Error(`Unavailable metric ${metric.id} must not declare a resolver`);
      }
    } else {
      if (!metric.resolverKey) {
        throw new Error(`Available metric ${metric.id} must declare a resolver`);
      }
      if (metric.reasonCode) {
        throw new Error(`Available metric ${metric.id} must not carry a reasonCode`);
      }
    }
  }
}

assertMetricRegistryIntegrity();
