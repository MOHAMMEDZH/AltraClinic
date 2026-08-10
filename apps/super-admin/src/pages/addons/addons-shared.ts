/**
 * Release 47 Step 15 — Add-ons, Commercial Overrides, and composition preview shared types.
 */
import type { StatusTone } from '../../ui';

export type AddOnTranslation = {
  locale: string;
  displayName: string;
  shortDescription: string;
};

export type AddOnVersionTranslation = {
  locale: string;
  releaseLabel: string;
  shortDescription: string;
};

export type AddOnSummary = {
  id: string;
  canonicalKey: string;
  lifecycle: string;
  rowVersion: number;
  systemSeeded: boolean;
  createdAt: string;
  updatedAt: string;
  translations: AddOnTranslation[];
};

export type AddOnDetail = AddOnSummary & {
  versions: Array<{ id: string; versionNumber: number; lifecycle: string }>;
  deferred: {
    subscriptionAssignment: string;
    runtimeEffective: boolean;
  };
};

export type AddOnLimitEffectType = 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED';

export type AddOnEntitlement = {
  catalogItemId: string;
  canonicalKey: string;
  kind: string;
};

export type AddOnLimitEffect = {
  catalogItemId: string;
  canonicalKey: string;
  effectType: AddOnLimitEffectType;
  unlimited: boolean;
  valueText: string | null;
};

export type AddOnApplicability = {
  planCanonicalKey: string;
};

export type AddOnVersion = {
  id: string;
  addOnId: string;
  versionNumber: number;
  lifecycle: string;
  rowVersion: number;
  publishedAt: string | null;
  publishedByPlatformUserId: string | null;
  publicationFingerprint: string | null;
  publicationReason: string | null;
  sourceVersionId: string | null;
  createdAt: string;
  updatedAt: string;
  translations: AddOnVersionTranslation[];
  runtimeEffective: false;
  entitlements?: AddOnEntitlement[];
  limitEffects?: AddOnLimitEffect[];
  applicability?: AddOnApplicability[];
};

export type AddOnVersionReadiness = {
  status: string;
  reason: string;
  translationReady: boolean;
  entitlementCount: number;
  limitEffectCount: number;
  applicabilityCount: number;
  publicationReady: boolean;
  blockers: Array<{ code: string; message: string }>;
  runtimeEffective: false;
  emptyDefinitionAllowed: boolean;
};

export type AddOnVersionCompare = {
  left: { id: string; versionNumber: number; lifecycle: string };
  right: { id: string; versionNumber: number; lifecycle: string };
  entitlementsAdded: string[];
  entitlementsRemoved: string[];
  runtimeEffective: false;
};

export type OverrideEffectKind =
  | 'ENTITLEMENT_GRANT'
  | 'ENTITLEMENT_SUPPRESS'
  | 'LIMIT_SET_ABSOLUTE'
  | 'LIMIT_INCREASE_BY'
  | 'LIMIT_SET_UNLIMITED';

export type OverrideReasonCode =
  | 'SALES_CONCESSION'
  | 'CONTRACTUAL_EXCEPTION'
  | 'SUPPORT_WAIVER'
  | 'TRIAL_EXTENSION'
  | 'OTHER';

export const OVERRIDE_REASON_CODES: readonly OverrideReasonCode[] = [
  'SALES_CONCESSION',
  'CONTRACTUAL_EXCEPTION',
  'SUPPORT_WAIVER',
  'TRIAL_EXTENSION',
  'OTHER',
] as const;

export const OVERRIDE_EFFECT_KINDS: readonly OverrideEffectKind[] = [
  'ENTITLEMENT_GRANT',
  'ENTITLEMENT_SUPPRESS',
  'LIMIT_SET_ABSOLUTE',
  'LIMIT_INCREASE_BY',
  'LIMIT_SET_UNLIMITED',
] as const;

export type OverrideEffect = {
  id: string;
  effectKind: string;
  catalogItemId: string;
  canonicalKey: string | null;
  kind: string | null;
  unlimited: boolean;
  valueText: string | null;
};

export type CommercialOverride = {
  id: string;
  lifecycle: string;
  rowVersion: number;
  reasonCode: string;
  reasonNote: string;
  effectiveFrom: string | null;
  expiresAt: string | null;
  createdByPlatformUserId: string;
  submittedByPlatformUserId: string | null;
  approvedByPlatformUserId: string | null;
  rejectedByPlatformUserId: string | null;
  revokedByPlatformUserId: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  revokedAt: string | null;
  rejectionReason: string | null;
  revocationReason: string | null;
  predecessorId: string | null;
  compositionFingerprint: string | null;
  createdAt: string;
  updatedAt: string;
  effects: OverrideEffect[];
  runtimeEffective: false;
  tenantAssignment: string;
};

export type OverrideReadiness = {
  status: string;
  reason: string;
  submitReady: boolean;
  blockers: Array<{ code: string; message: string }>;
  runtimeEffective: false;
};

export type OverrideCompare = {
  left: { id: string; lifecycle: string; fingerprint: string | null };
  right: { id: string; lifecycle: string; fingerprint: string | null };
  effectsAdded: string[];
  effectsRemoved: string[];
  runtimeEffective: false;
};

export type CompositionPreviewResult = {
  disclaimer: string;
  runtimeEffective: false;
  entitlements: string[];
  limits: Array<{ canonicalKey: string; unlimited: boolean; valueText: string | null }>;
  layers: {
    baseEntitlementCount: number;
    addonGrantedCount: number;
    overrideGrantedCount: number;
    overrideSuppressedCount: number;
  };
  planCanonicalKey: string;
  planVersionId: string;
  planVersionLifecycle: string;
  addonVersionIds: string[];
  overrideIds: string[];
  licensingEngineCalled: false;
};

export type AddOnVersionPanel =
  | 'overview'
  | 'entitlements'
  | 'limits'
  | 'applicability'
  | 'readiness'
  | 'compare';

export function addOnDisplayName(row: AddOnSummary, locale: string): string {
  const preferred = row.translations.find((t) => t.locale === locale)?.displayName;
  if (preferred) return preferred;
  return row.translations.find((t) => t.locale === 'en-US')?.displayName ?? row.canonicalKey;
}

export function addOnLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'ACTIVE':
      return 'success';
    case 'DRAFT':
      return 'info';
    case 'ARCHIVED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function versionLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'PUBLISHED':
      return 'success';
    case 'DRAFT':
      return 'info';
    case 'RETIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function overrideLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'APPROVED':
      return 'success';
    case 'PENDING_APPROVAL':
      return 'warning';
    case 'DRAFT':
      return 'info';
    case 'REJECTED':
    case 'REVOKED':
    case 'EXPIRED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function isOverrideImmutable(lifecycle: string): boolean {
  return lifecycle === 'APPROVED' || lifecycle === 'REJECTED' || lifecycle === 'REVOKED' || lifecycle === 'EXPIRED';
}

export function isAddOnVersionMutable(lifecycle: string): boolean {
  return lifecycle === 'DRAFT';
}

export const STATIC_COMMERCIAL_PREVIEW_WARNING =
  'Static commercial preview only. Tenant runtime access is unchanged.';
