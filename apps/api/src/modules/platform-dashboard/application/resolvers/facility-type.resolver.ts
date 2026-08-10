/**
 * Release 47 Step 10 — Legacy facility-type distribution resolver.
 *
 * Aggregates `tenants.features.clinicProfile.clinicType` in PostgreSQL so
 * application memory never holds per-tenant feature JSON. Only fixed buckets
 * are returned: medical | dental | beauty | multi | unclassified.
 * Raw free-text values never leave the database.
 *
 * The platform audit sentinel tenant is excluded at the SQL level so customer
 * Dashboard metrics are unchanged when directory audits upsert the sentinel.
 */
import { Prisma } from '@prisma/client';
import {
  type DashboardPrismaClient,
  type MetricBreakdownValue,
  type ResolvedMetricValue,
} from './resolver.types';
import { excludePlatformAuditSentinelSql } from '../../../platform-tenants/platform-tenants.tokens';

const KNOWN_FACILITY_TYPES = ['medical', 'dental', 'beauty', 'multi'] as const;
const UNCLASSIFIED = 'unclassified';
const BUCKET_ORDER = [...KNOWN_FACILITY_TYPES, UNCLASSIFIED] as const;

function facilityTypeLabelKey(bucket: string): string {
  return `dashboard.breakdown.facilityType.${bucket}`;
}

interface FacilityBucketRow {
  bucket: string;
  count: number;
}

export async function resolveFacilityTypeDistribution(
  client: DashboardPrismaClient,
): Promise<ResolvedMetricValue> {
  // Aggregate in the database — do not load features JSON into the app.
  const rows = await client.$queryRaw<FacilityBucketRow[]>(Prisma.sql`
    SELECT bucket, COUNT(*)::int AS count
    FROM (
      SELECT
        CASE
          WHEN lower(trim(coalesce(features->'clinicProfile'->>'clinicType', '')))
            IN ('medical', 'dental', 'beauty', 'multi')
          THEN lower(trim(features->'clinicProfile'->>'clinicType'))
          ELSE 'unclassified'
        END AS bucket
      FROM tenants
      WHERE "deletedAt" IS NULL
        AND ${excludePlatformAuditSentinelSql()}
    ) classified
    GROUP BY bucket
  `);

  const counts = new Map<string, number>();
  for (const row of rows) {
    const key =
      (KNOWN_FACILITY_TYPES as readonly string[]).includes(row.bucket) || row.bucket === UNCLASSIFIED
        ? row.bucket
        : UNCLASSIFIED;
    counts.set(key, (counts.get(key) ?? 0) + Number(row.count));
  }

  const breakdown: MetricBreakdownValue[] = BUCKET_ORDER.map((bucket) => ({
    key: bucket,
    labelKey: facilityTypeLabelKey(bucket),
    count: counts.get(bucket) ?? 0,
  }));

  const value = breakdown.reduce((sum, item) => sum + item.count, 0);
  return { value, breakdown };
}
