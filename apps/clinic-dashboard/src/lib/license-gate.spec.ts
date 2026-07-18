import { describe, expect, it } from 'vitest';
import {
  getLicenseGateReasonKey,
  isBlockedLicenseStatus,
  isGracePeriodExpired,
  isSubscriptionAllowlisted,
  requiresLicenseExperience,
} from './license-gate';

describe('license-gate', () => {
  it('blocks inactive lifecycle statuses', () => {
    for (const status of ['expired', 'suspended', 'cancelled', 'grace'] as const) {
      expect(isBlockedLicenseStatus(status)).toBe(true);
      expect(
        requiresLicenseExperience({
          entitlementsVerified: true,
          safeMode: false,
          licenseStatus: status,
        }),
      ).toBe(true);
    }
  });

  it('allows active and trial tenants', () => {
    for (const status of ['active', 'trial', 'ACTIVE', 'TRIAL']) {
      expect(
        requiresLicenseExperience({
          entitlementsVerified: true,
          safeMode: false,
          licenseStatus: status,
        }),
      ).toBe(false);
    }
  });

  it('fails closed when entitlements are unverified', () => {
    expect(
      requiresLicenseExperience({
        entitlementsVerified: false,
        safeMode: false,
        licenseStatus: 'active',
      }),
    ).toBe(true);
  });

  it('detects grace period expiration', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString();
    expect(isGracePeriodExpired(past)).toBe(true);
    expect(
      getLicenseGateReasonKey({
        entitlementsVerified: true,
        safeMode: false,
        licenseStatus: 'grace',
        gracePeriodEndsAt: past,
      }),
    ).toBe('graceExpired');
  });

  it('allowlists subscription workspace routes', () => {
    expect(isSubscriptionAllowlisted('/settings/subscription')).toBe(true);
    expect(isSubscriptionAllowlisted('/settings/subscription/plans')).toBe(true);
    expect(isSubscriptionAllowlisted('/dashboard')).toBe(false);
    expect(isSubscriptionAllowlisted('/patients')).toBe(false);
  });
});
