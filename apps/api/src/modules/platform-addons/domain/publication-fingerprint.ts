import { createHash } from 'crypto';
import type { AddOnLimitEffectType } from '../platform-addons.tokens';

export const ADDON_PUBLICATION_FINGERPRINT_SCHEMA = 1;

export interface AddonPublicationEntitlement {
  canonicalKey: string;
  kind: string;
}

export interface AddonPublicationLimitEffect {
  canonicalKey: string;
  effectType: AddOnLimitEffectType;
  unlimited: boolean;
  valueText: string | null;
}

export interface AddonPublicationFingerprintInput {
  addOnCanonicalKey: string;
  versionNumber: number;
  sourceVersionId: string | null;
  translations: Array<{ locale: string; releaseLabel: string; shortDescription: string }>;
  entitlements: AddonPublicationEntitlement[];
  limitEffects: AddonPublicationLimitEffect[];
  applicabilityPlanKeys: string[];
}

/** Stable Add-on Version publication fingerprint — excludes rowVersion, actor, timestamps. */
export function buildAddonPublicationFingerprint(input: AddonPublicationFingerprintInput): string {
  const payload = {
    schemaVersion: ADDON_PUBLICATION_FINGERPRINT_SCHEMA,
    addOnCanonicalKey: input.addOnCanonicalKey,
    versionNumber: input.versionNumber,
    sourceVersionId: input.sourceVersionId,
    translations: [...input.translations].sort((a, b) => a.locale.localeCompare(b.locale)),
    entitlements: [...input.entitlements]
      .map((e) => ({ canonicalKey: e.canonicalKey, kind: e.kind }))
      .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
    limitEffects: [...input.limitEffects]
      .map((l) => ({
        canonicalKey: l.canonicalKey,
        effectType: l.effectType,
        unlimited: l.unlimited,
        valueText: l.valueText,
      }))
      .sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
    applicabilityPlanKeys: [...input.applicabilityPlanKeys].sort(),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

export interface OverrideCompositionFingerprintInput {
  reasonCode: string;
  reasonNote: string;
  effectiveFrom: string | null;
  expiresAt: string | null;
  effects: Array<{
    effectKind: string;
    catalogItemCanonicalKey: string;
    unlimited: boolean;
    valueText: string | null;
  }>;
}

/** Stable fingerprint of override commercial composition (definition plane). */
export function buildOverrideCompositionFingerprint(
  input: OverrideCompositionFingerprintInput,
): string {
  const payload = {
    reasonCode: input.reasonCode,
    reasonNote: input.reasonNote,
    effectiveFrom: input.effectiveFrom,
    expiresAt: input.expiresAt,
    effects: [...input.effects]
      .map((e) => ({
        effectKind: e.effectKind,
        catalogItemCanonicalKey: e.catalogItemCanonicalKey,
        unlimited: e.unlimited,
        valueText: e.valueText,
      }))
      .sort((a, b) => {
        const k = a.catalogItemCanonicalKey.localeCompare(b.catalogItemCanonicalKey);
        return k !== 0 ? k : a.effectKind.localeCompare(b.effectKind);
      }),
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}
