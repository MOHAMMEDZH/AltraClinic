import { SUBSCRIPTION_ROUTES } from '@/features/subscription/lib/subscription-routes';

export type BlockedLicenseStatus = 'expired' | 'suspended' | 'cancelled' | 'grace';

const BLOCKED_STATUSES = new Set<BlockedLicenseStatus>([
  'expired',
  'suspended',
  'cancelled',
  'grace',
]);

function normalizeLicenseStatus(status: string | undefined): string {
  return status?.trim().toLowerCase() ?? '';
}

export function isBlockedLicenseStatus(status: string | undefined): status is BlockedLicenseStatus {
  return BLOCKED_STATUSES.has(normalizeLicenseStatus(status) as BlockedLicenseStatus);
}

export function isGracePeriodExpired(gracePeriodEndsAt: string | null | undefined): boolean {
  if (!gracePeriodEndsAt) return false;
  return Date.now() > new Date(gracePeriodEndsAt).getTime();
}

export interface LicenseGateInput {
  entitlementsVerified: boolean;
  safeMode: boolean;
  licenseStatus?: string;
  gracePeriodEndsAt?: string | null;
}

/** True when the tenant must not enter the normal dashboard shell. */
export function requiresLicenseExperience(input: LicenseGateInput): boolean {
  if (!input.entitlementsVerified || input.safeMode) return true;

  const status = normalizeLicenseStatus(input.licenseStatus);
  if (status === 'grace' && isGracePeriodExpired(input.gracePeriodEndsAt)) return true;
  return isBlockedLicenseStatus(status);
}

export function isSubscriptionAllowlisted(pathname: string): boolean {
  const normalized =
    pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

  return SUBSCRIPTION_ROUTES.some(
    (route) => normalized === route || normalized.startsWith(`${route}/`),
  );
}

export function getLicenseGateReasonKey(
  input: LicenseGateInput,
): 'unverified' | BlockedLicenseStatus | 'graceExpired' {
  if (!input.entitlementsVerified || input.safeMode) return 'unverified';

  const status = normalizeLicenseStatus(input.licenseStatus);
  if (status === 'grace' && isGracePeriodExpired(input.gracePeriodEndsAt)) return 'graceExpired';
  if (isBlockedLicenseStatus(status)) return status;
  return 'unverified';
}
