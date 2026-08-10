/**
 * Release 47 Step 10 — Commercial subscription resolver.
 * Real aggregate over `platform_subscriptions.status`.
 */
import {
  countOf,
  type DashboardPrismaClient,
  type MetricBreakdownValue,
  type ResolvedMetricValue,
} from './resolver.types';

/** Frozen order of subscription statuses (seeded even when count is 0). */
const SUBSCRIPTION_STATUSES = [
  'TRIAL',
  'ACTIVE',
  'SUSPENDED',
  'EXPIRED',
  'CANCELLED',
] as const;

function statusLabelKey(status: string): string {
  return `dashboard.breakdown.subscriptionStatus.${status.toLowerCase()}`;
}

export async function resolveSubscriptionByStatus(
  client: DashboardPrismaClient,
): Promise<ResolvedMetricValue> {
  const rows = await client.platformSubscription.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const counts = new Map<string, number>();
  for (const row of rows) {
    const status = String((row as Record<string, unknown>).status ?? '');
    if (status) counts.set(status, countOf(row));
  }

  const breakdown: MetricBreakdownValue[] = SUBSCRIPTION_STATUSES.map((status) => ({
    key: status,
    labelKey: statusLabelKey(status),
    count: counts.get(status) ?? 0,
  }));

  const value = breakdown.reduce((sum, item) => sum + item.count, 0);
  return { value, breakdown };
}
