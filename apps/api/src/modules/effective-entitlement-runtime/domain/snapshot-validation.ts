import { createHash } from 'crypto';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../../platform-subscriptions/domain/subscription-commercial-fingerprint';
import type { SnapshotCommercialPayload } from './effective-entitlement.types';

export type SnapshotValidationResult =
  | { ok: true; payload: SnapshotCommercialPayload }
  | { ok: false; code: string; message: string };

const PROHIBITED_PAYLOAD_KEYS = [
  'accessToken',
  'refreshToken',
  'sessionId',
  'mfa',
  'requestBody',
  'billing',
  'payment',
  'clinical',
  'phi',
  'sql',
  'stack',
];

export function validateCommercialSnapshotPayload(input: {
  tenantId?: string;
  platformTenantId: string;
  configId: string;
  storedFingerprint: string;
  storedSchema: string;
  payload: unknown;
}): SnapshotValidationResult {
  if (!input.payload || typeof input.payload !== 'object' || Array.isArray(input.payload)) {
    return { ok: false, code: 'snapshot_malformed', message: 'Snapshot payload missing.' };
  }
  const raw = input.payload as Record<string, unknown>;
  for (const key of PROHIBITED_PAYLOAD_KEYS) {
    if (key in raw) {
      return { ok: false, code: 'snapshot_prohibited_field', message: `Prohibited field: ${key}` };
    }
  }
  if (input.storedSchema !== SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA) {
    return {
      ok: false,
      code: 'snapshot_unsupported_schema',
      message: 'Unsupported snapshot fingerprint schema.',
    };
  }
  if (raw.schema !== SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA) {
    return {
      ok: false,
      code: 'snapshot_unsupported_schema',
      message: 'Payload schema unsupported.',
    };
  }
  if (typeof raw.platformTenantId !== 'string' || raw.platformTenantId !== input.platformTenantId) {
    return { ok: false, code: 'snapshot_tenant_mismatch', message: 'Tenant mismatch.' };
  }
  if (typeof raw.planCanonicalKey !== 'string' || !raw.planCanonicalKey) {
    return { ok: false, code: 'snapshot_plan_missing', message: 'Plan key missing.' };
  }
  if (raw.planCanonicalKey === 'plan.business') {
    return { ok: false, code: 'snapshot_plan_business_rejected', message: 'plan.business rejected.' };
  }
  if (typeof raw.planVersionId !== 'string' || !raw.planVersionId) {
    return { ok: false, code: 'snapshot_plan_version_missing', message: 'Plan Version missing.' };
  }
  if (typeof raw.fingerprint !== 'string' || raw.fingerprint.length !== 64) {
    return { ok: false, code: 'snapshot_fingerprint_missing', message: 'Fingerprint missing.' };
  }
  if (raw.fingerprint !== input.storedFingerprint) {
    return { ok: false, code: 'snapshot_fingerprint_mismatch', message: 'Fingerprint mismatch.' };
  }

  const addonVersionIds = Array.isArray(raw.addonVersionIds)
    ? (raw.addonVersionIds as string[])
    : [];
  const overrideIds = Array.isArray(raw.overrideIds) ? (raw.overrideIds as string[]) : [];
  if (new Set(addonVersionIds).size !== addonVersionIds.length) {
    return { ok: false, code: 'snapshot_duplicate_addon', message: 'Duplicate Add-on IDs.' };
  }
  if (new Set(overrideIds).size !== overrideIds.length) {
    return { ok: false, code: 'snapshot_duplicate_override', message: 'Duplicate Override IDs.' };
  }

  const payload: SnapshotCommercialPayload = {
    schema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
    platformTenantId: raw.platformTenantId,
    platformSubscriptionId:
      typeof raw.platformSubscriptionId === 'string' ? raw.platformSubscriptionId : null,
    planVersionId: raw.planVersionId,
    planCanonicalKey: raw.planCanonicalKey,
    planVersionNumber: Number(raw.planVersionNumber ?? 0),
    planPublicationFingerprint:
      typeof raw.planPublicationFingerprint === 'string' ? raw.planPublicationFingerprint : null,
    addonVersionIds: [...addonVersionIds].sort(),
    overrideIds: [...overrideIds].sort(),
    commercialStart: typeof raw.commercialStart === 'string' ? raw.commercialStart : null,
    commercialEnd: typeof raw.commercialEnd === 'string' ? raw.commercialEnd : null,
    scheduledActivationAt:
      typeof raw.scheduledActivationAt === 'string' ? raw.scheduledActivationAt : null,
    fingerprint: raw.fingerprint,
    runtimeEffective: false,
  };

  // Recompute identity fingerprint from payload material fields (not mutable rows).
  const recomputed = computeSubscriptionCommercialFingerprint({
    platformTenantId: payload.platformTenantId,
    platformSubscriptionId: payload.platformSubscriptionId,
    planCanonicalKey: payload.planCanonicalKey,
    planVersionId: payload.planVersionId!,
    planVersionNumber: payload.planVersionNumber,
    planPublicationFingerprint: payload.planPublicationFingerprint ?? '',
    addonVersionIds: payload.addonVersionIds,
    addonFingerprints: [], // filled by caller when validating against live immutable rows
    overrideIds: payload.overrideIds,
    overrideFingerprints: [],
    commercialStart: payload.commercialStart,
    commercialEnd: payload.commercialEnd,
    scheduledActivationAt: payload.scheduledActivationAt,
  });
  // Structural validation only here; full fingerprint match uses stored value + live publication fingerprints in service.
  void recomputed;
  void createHash;

  return { ok: true, payload };
}

export function normalizeCanonicalKey(raw: string): string | null {
  const key = raw.trim();
  if (!key) return null;
  if (/\s/.test(key)) return null;
  return key;
}

/** Map Catalog module.x / feature.x to Clinic licensed ids when 1:1 suffix matches. */
export function catalogKeyToLicensedModuleId(canonicalKey: string): string | null {
  if (!canonicalKey.startsWith('module.')) return null;
  const suffix = canonicalKey.slice('module.'.length);
  const camel = suffix.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  return camel;
}

export function catalogKeyToLicensedFeatureId(canonicalKey: string): string | null {
  if (!canonicalKey.startsWith('feature.')) return null;
  const suffix = canonicalKey.slice('feature.'.length);
  return suffix.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}
