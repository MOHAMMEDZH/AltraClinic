/**
 * Scopes a privileged-access grant authorizes a platform administrator to
 * exercise inside a tenant (just-in-time / break-glass access). Deliberately
 * coarse and explicit so each elevation states exactly what it permits.
 *  - read_only        — inspect tenant data for support/diagnostics.
 *  - support          — perform supported, non-destructive support actions.
 *  - billing          — billing/subscription remediation.
 *  - configuration    — change tenant configuration/feature flags.
 *  - emergency_write  — emergency data correction (highest risk).
 */
export const PRIVILEGED_ACCESS_SCOPES = [
  'read_only',
  'support',
  'billing',
  'configuration',
  'emergency_write',
] as const;

export type PrivilegedAccessScope = (typeof PRIVILEGED_ACCESS_SCOPES)[number];

export function isPrivilegedAccessScope(value: unknown): value is PrivilegedAccessScope {
  return typeof value === 'string' && (PRIVILEGED_ACCESS_SCOPES as readonly string[]).includes(value);
}
