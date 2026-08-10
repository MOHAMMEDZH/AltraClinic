/**
 * Release 47 Step 10 — Resolver contracts.
 *
 * Resolvers receive a platform-bypass Prisma client (RLS bypassed for
 * cross-tenant aggregates AFTER the caller's permission has been verified) and
 * return only aggregate counts. They must never return rows, identifiers, or
 * free text.
 *
 * The client is described by a narrow structural type so resolvers stay easy to
 * unit-test with a mock and are not coupled to Prisma's generated generics.
 */

export interface MetricBreakdownValue {
  readonly key: string;
  readonly labelKey: string;
  readonly count: number;
}

export interface ResolvedMetricValue {
  readonly value: number | null;
  readonly breakdown?: MetricBreakdownValue[];
}

interface GroupByCountRow {
  readonly _count: { readonly _all: number } | number;
}

export interface DashboardPrismaClient {
  platformTenant: {
    count(args?: unknown): Promise<number>;
    groupBy(args: unknown): Promise<Array<GroupByCountRow & Record<string, unknown>>>;
  };
  platformSubscription: {
    groupBy(args: unknown): Promise<Array<GroupByCountRow & Record<string, unknown>>>;
  };
  tenant: {
    findMany(args: unknown): Promise<Array<{ features: unknown }>>;
  };
  /** Required for facility-type SQL aggregation (no in-memory feature scan). */
  $queryRaw<T = unknown>(query: unknown, ...values: unknown[]): Promise<T>;
}

export type MetricResolver = (client: DashboardPrismaClient) => Promise<ResolvedMetricValue>;

/** Normalizes Prisma groupBy `_count` shape (`{ _all }` or bare number). */
export function countOf(row: GroupByCountRow): number {
  const c = row._count;
  return typeof c === 'number' ? c : c._all;
}
