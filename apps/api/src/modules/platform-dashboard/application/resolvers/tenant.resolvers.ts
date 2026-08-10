/**
 * Release 47 Step 10 — Tenant footprint resolvers.
 * Real aggregates over `platform_tenants`. No PHI, no tenant identifiers.
 */
import {
  countOf,
  type DashboardPrismaClient,
  type MetricBreakdownValue,
  type ResolvedMetricValue,
} from './resolver.types';

/** Frozen order of platform tenant statuses (seeded even when count is 0). */
const TENANT_STATUSES = ['PROVISIONING', 'ACTIVE', 'SUSPENDED', 'ARCHIVED'] as const;

function statusLabelKey(status: string): string {
  return `dashboard.breakdown.tenantStatus.${status.toLowerCase()}`;
}

export async function resolveTenantTotal(
  client: DashboardPrismaClient,
): Promise<ResolvedMetricValue> {
  const value = await client.platformTenant.count();
  return { value };
}

export async function resolveTenantByStatus(
  client: DashboardPrismaClient,
): Promise<ResolvedMetricValue> {
  const rows = await client.platformTenant.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const status = String((row as Record<string, unknown>).status ?? '');
    if (status) counts.set(status, countOf(row));
  }

  const breakdown: MetricBreakdownValue[] = TENANT_STATUSES.map((status) => ({
    key: status,
    labelKey: statusLabelKey(status),
    count: counts.get(status) ?? 0,
  }));

  const value = breakdown.reduce((sum, item) => sum + item.count, 0);
  return { value, breakdown };
}

export interface ResolveTenantTrialingOptions {
  /**
   * Test-only controlled clock. Production callers must omit this so the
   * server clock is used. Never accept a client-supplied timestamp over HTTP.
   */
  readonly now?: Date;
}

export async function resolveTenantTrialing(
  client: DashboardPrismaClient,
  options: ResolveTenantTrialingOptions = {},
): Promise<ResolvedMetricValue> {
  // Server clock by default — never a client-supplied "now" on the HTTP path.
  const now = options.now ?? new Date();
  const value = await client.platformTenant.count({
    where: {
      trialEndsAt: { not: null, gt: now },
      status: { not: 'ARCHIVED' },
    },
  });
  return { value };
}
