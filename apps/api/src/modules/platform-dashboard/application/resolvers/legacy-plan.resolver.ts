/**
 * Release 47 Step 10 — Legacy plan tier assignment resolver.
 *
 * Aggregates the LEGACY `platform_tenants.plan` tier column (LITE/PRO/
 * ENTERPRISE). This is explicitly a legacy tier assignment — it is NOT a Plan
 * Version (there is no Plan Version Source of Record yet; that is Step 13).
 */
import {
  countOf,
  type DashboardPrismaClient,
  type MetricBreakdownValue,
  type ResolvedMetricValue,
} from './resolver.types';

/** Frozen order of legacy entitlement tiers (seeded even when count is 0). */
const LEGACY_PLANS = ['LITE', 'PRO', 'ENTERPRISE'] as const;

function legacyPlanLabelKey(plan: string): string {
  return `dashboard.breakdown.legacyPlan.${plan.toLowerCase()}`;
}

export async function resolveLegacyPlanAssignment(
  client: DashboardPrismaClient,
): Promise<ResolvedMetricValue> {
  const rows = await client.platformTenant.groupBy({
    by: ['plan'],
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const plan = String((row as Record<string, unknown>).plan ?? '');
    if (plan) counts.set(plan, countOf(row));
  }

  const breakdown: MetricBreakdownValue[] = LEGACY_PLANS.map((plan) => ({
    key: plan,
    labelKey: legacyPlanLabelKey(plan),
    count: counts.get(plan) ?? 0,
  }));

  const value = breakdown.reduce((sum, item) => sum + item.count, 0);
  return { value, breakdown };
}
