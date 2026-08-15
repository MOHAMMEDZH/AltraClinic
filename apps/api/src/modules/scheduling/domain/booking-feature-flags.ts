/**
 * Wave B booking feature flags on Tenant.features.
 */
export const BOOKING_ELIGIBILITY_ENFORCEMENT_FLAG = 'booking.eligibility.enforcement';
export const BILLING_INVOICE_FROM_SNAPSHOT_FLAG = 'billing.invoice.from.snapshot';

function readBoolFlag(
  features: Record<string, unknown> | null | undefined,
  key: string,
  defaultWhenMissing: boolean,
): boolean {
  if (!features || typeof features !== 'object') return defaultWhenMissing;
  const raw = features[key];
  if (raw === undefined || raw === null) return defaultWhenMissing;
  if (typeof raw === 'boolean') return raw;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return defaultWhenMissing;
}

/** Missing/false = OFF (bounded legacy allow). ON = DEFAULT DENY. */
export function isBookingEligibilityEnforcementEnabled(
  features: Record<string, unknown> | null | undefined,
): boolean {
  return readBoolFlag(features, BOOKING_ELIGIBILITY_ENFORCEMENT_FLAG, false);
}

/** Missing/false = OFF (bounded legacy invoice path). ON = effective snapshot required for canonical. */
export function isBillingInvoiceFromSnapshotEnabled(
  features: Record<string, unknown> | null | undefined,
): boolean {
  return readBoolFlag(features, BILLING_INVOICE_FROM_SNAPSHOT_FLAG, false);
}
