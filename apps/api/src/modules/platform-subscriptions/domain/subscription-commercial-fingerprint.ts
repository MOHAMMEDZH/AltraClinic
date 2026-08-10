import { createHash } from 'crypto';

export const SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA = 'subscription-commercial-fingerprint/v1';

export type CommercialFingerprintInput = {
  platformTenantId: string;
  /** Optional runtime correlation — never auto-selected; null when uncorrelated. */
  platformSubscriptionId: string | null;
  planCanonicalKey: string;
  planVersionId: string;
  planVersionNumber: number;
  planPublicationFingerprint: string;
  addonVersionIds: string[];
  addonFingerprints: string[];
  overrideIds: string[];
  overrideFingerprints: string[];
  commercialStart: string | null;
  commercialEnd: string | null;
  scheduledActivationAt: string | null;
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

/** Deterministic commercial fingerprint — order-independent assignment arrays. */
export function computeSubscriptionCommercialFingerprint(input: CommercialFingerprintInput): string {
  const payload = {
    schema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
    platformTenantId: input.platformTenantId,
    platformSubscriptionId: input.platformSubscriptionId,
    planCanonicalKey: input.planCanonicalKey,
    planVersionId: input.planVersionId,
    planVersionNumber: input.planVersionNumber,
    planPublicationFingerprint: input.planPublicationFingerprint,
    addonVersionIds: [...input.addonVersionIds].sort(),
    addonFingerprints: [...input.addonFingerprints].sort(),
    overrideIds: [...input.overrideIds].sort(),
    overrideFingerprints: [...input.overrideFingerprints].sort(),
    commercialStart: input.commercialStart,
    commercialEnd: input.commercialEnd,
    scheduledActivationAt: input.scheduledActivationAt,
  };
  return createHash('sha256').update(stableStringify(payload)).digest('hex');
}
