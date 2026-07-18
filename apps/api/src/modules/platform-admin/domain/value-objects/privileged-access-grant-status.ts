/**
 * Stored lifecycle states of a privileged-access grant. `expired` is NOT stored;
 * it is derived from `active` + the grant's expiry at read time
 * (see {@link PrivilegedAccessGrant.effectiveStatus}).
 */
export const PRIVILEGED_ACCESS_GRANT_STATUSES = [
  'pending_approval',
  'active',
  'rejected',
  'revoked',
] as const;

export type PrivilegedAccessGrantStatus = (typeof PRIVILEGED_ACCESS_GRANT_STATUSES)[number];

/** Includes the derived `expired` state for read projections. */
export type EffectivePrivilegedAccessGrantStatus = PrivilegedAccessGrantStatus | 'expired';
