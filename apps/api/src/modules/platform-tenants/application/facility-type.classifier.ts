/**
 * Controlled facility-type buckets (aligned with Step 10 Dashboard).
 * Never returns arbitrary JSON values as labels.
 */
export const FACILITY_TYPE_BUCKETS = ['medical', 'dental', 'beauty', 'multi', 'unclassified'] as const;
export type FacilityTypeBucket = (typeof FACILITY_TYPE_BUCKETS)[number];

export function classifyFacilityType(features: unknown): FacilityTypeBucket {
  if (!features || typeof features !== 'object') return 'unclassified';
  const clinicProfile = (features as Record<string, unknown>).clinicProfile;
  if (!clinicProfile || typeof clinicProfile !== 'object') return 'unclassified';
  const clinicType = (clinicProfile as Record<string, unknown>).clinicType;
  if (typeof clinicType !== 'string') return 'unclassified';
  const normalized = clinicType.trim().toLowerCase();
  if (
    normalized === 'medical' ||
    normalized === 'dental' ||
    normalized === 'beauty' ||
    normalized === 'multi'
  ) {
    return normalized;
  }
  return 'unclassified';
}

/** SQL CASE expression body matching classifyFacilityType (tenants.features). */
export const FACILITY_TYPE_SQL_CASE = `
  CASE
    WHEN lower(trim(coalesce(features->'clinicProfile'->>'clinicType', '')))
      IN ('medical', 'dental', 'beauty', 'multi')
    THEN lower(trim(features->'clinicProfile'->>'clinicType'))
    ELSE 'unclassified'
  END
`;
