import { createHash } from 'crypto';

export const PUBLICATION_FINGERPRINT_SCHEMA_V1 = 1;
export const PUBLICATION_FINGERPRINT_SCHEMA_V2 = 2;

export interface PublicationFingerprintV1Input {
  planCanonicalKey: string;
  versionNumber: number;
  effectiveFrom: string | null;
  retireAt: string | null;
  trialDefaultEnabled: boolean | null;
  trialDefaultDays: number | null;
  priceAmountMinor: number | null;
  priceCurrency: string | null;
  billingInterval: string | null;
  billingIntervalCount: number | null;
  translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
}

export interface PublicationFingerprintEntitlement {
  canonicalKey: string;
  kind: string;
}

export interface PublicationFingerprintLimit {
  canonicalKey: string;
  unlimited: boolean;
  valueText: string | null;
}

export interface PublicationFingerprintV2Input extends PublicationFingerprintV1Input {
  schemaVersion: typeof PUBLICATION_FINGERPRINT_SCHEMA_V2;
  sourceVersionId: string | null;
  entitlements: PublicationFingerprintEntitlement[];
  limits: PublicationFingerprintLimit[];
}

/** Stable publication fingerprint — excludes rowVersion, actor email, audit, timestamps that change on retry. */
export function buildPublicationFingerprint(input: PublicationFingerprintV1Input): string {
  const payload = {
    ...input,
    translations: [...input.translations].sort((a, b) => a.locale.localeCompare(b.locale)),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * Step 14 fingerprint — includes explicit entitlements and typed Limits.
 * Existing Step 13 fingerprints remain buildPublicationFingerprint (v1 shape, no schemaVersion field).
 */
export function buildPublicationFingerprintV2(input: Omit<PublicationFingerprintV2Input, 'schemaVersion'>): string {
  const entitlements = [...input.entitlements]
    .map((e) => ({ canonicalKey: e.canonicalKey, kind: e.kind }))
    .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  const limits = [...input.limits]
    .map((l) => ({
      canonicalKey: l.canonicalKey,
      unlimited: l.unlimited,
      valueText: l.valueText,
    }))
    .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey));
  const payload: PublicationFingerprintV2Input = {
    schemaVersion: PUBLICATION_FINGERPRINT_SCHEMA_V2,
    planCanonicalKey: input.planCanonicalKey,
    versionNumber: input.versionNumber,
    effectiveFrom: input.effectiveFrom,
    retireAt: input.retireAt,
    trialDefaultEnabled: input.trialDefaultEnabled,
    trialDefaultDays: input.trialDefaultDays,
    priceAmountMinor: input.priceAmountMinor,
    priceCurrency: input.priceCurrency,
    billingInterval: input.billingInterval,
    billingIntervalCount: input.billingIntervalCount,
    translations: [...input.translations].sort((a, b) => a.locale.localeCompare(b.locale)),
    sourceVersionId: input.sourceVersionId,
    entitlements,
    limits,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
