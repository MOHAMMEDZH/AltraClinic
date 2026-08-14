/**
 * Wave A — catalog.canonical.write on Tenant.features.
 * Missing flag defaults to enabled (write foundation ON).
 * Booking cutover remains OFF elsewhere; this gate only blocks tenant canonical writes.
 */
export const CATALOG_CANONICAL_WRITE_FLAG = 'catalog.canonical.write';

export function isTenantCanonicalWriteEnabled(
  features: Record<string, unknown> | null | undefined,
): boolean {
  if (!features || typeof features !== 'object') {
    return true;
  }
  const raw = features[CATALOG_CANONICAL_WRITE_FLAG];
  if (raw === undefined || raw === null) {
    return true;
  }
  if (typeof raw === 'boolean') {
    return raw;
  }
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return true;
}
