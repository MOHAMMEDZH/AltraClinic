/**
 * Release 47 Step 16 — Commercial subscription configuration shared types.
 */
import type { StatusTone } from '../../ui';

export type SubscriptionCommercialLifecycle =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE_COMMERCIAL'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SUPERSEDED';

export type SubscriptionSummary = {
  id: string;
  platformTenantId: string;
  lifecycle: string;
  planCanonicalKey: string | null;
  addonCount: number;
  overrideCount: number;
  isCurrent: boolean;
  disclaimer: string;
};

export type SubscriptionDetail = {
  id: string;
  platformTenantId: string;
  platformSubscriptionId: string | null;
  lifecycle: SubscriptionCommercialLifecycle;
  isCurrent: boolean;
  rowVersion: number;
  planVersionId: string | null;
  planCanonicalKey: string | null;
  planVersionNumber: number | null;
  planPublicationFingerprint: string | null;
  addonVersionIds: string[];
  overrideIds: string[];
  addonCount: number;
  overrideCount: number;
  commercialStart: string | null;
  commercialEnd: string | null;
  scheduledActivationAt: string | null;
  cancelledAt: string | null;
  cancellationEffectiveAt: string | null;
  commercialFingerprint: string | null;
  fingerprintSchemaVersion: number | null;
  predecessorId: string | null;
  hasSnapshot: boolean;
  createdAt: string;
  updatedAt: string;
  runtimeEffective: false;
  disclaimer: string;
};

export type SubscriptionReadiness = {
  status: 'ready' | 'blocked';
  blockers: Array<{ code: string; message: string; ref?: string }>;
  warnings: Array<{ code: string; message: string; ref?: string }>;
  fingerprintAvailable: boolean;
  runtimeEffective: false;
  disclaimer: string;
};

export type SubscriptionPreview = {
  readiness: SubscriptionReadiness;
  composition: Record<string, unknown> | null;
  runtimeEffective: false;
  disclaimer: string;
};

export type SubscriptionCompare = {
  left: SubscriptionDetail;
  right: SubscriptionDetail;
  differences: {
    planVersionChanged: boolean;
    addonsChanged: boolean;
    overridesChanged: boolean;
    datesChanged: boolean;
    lifecycleChanged: boolean;
  };
  runtimeEffective: false;
  disclaimer: string;
};

export type SubscriptionHistoryItem = {
  id: string;
  action: string;
  beforeLifecycle: string | null;
  afterLifecycle: string | null;
  createdAt: string;
};

export type SubscriptionHistory = {
  items: SubscriptionHistoryItem[];
  runtimeEffective: false;
  disclaimer: string;
};

export type SubscriptionPanel =
  | 'overview'
  | 'plan'
  | 'addons'
  | 'overrides'
  | 'dates'
  | 'readiness'
  | 'preview'
  | 'history'
  | 'compare'
  | 'runtime';

/** Bounded platform runtime inspection projection (Step 17). No raw snapshot JSON / PHI / tokens. */
export type SubscriptionRuntimeInspection = {
  source: 'SNAPSHOT' | 'LEGACY';
  code: string;
  lifecycle?: string;
  snapshotId?: string;
  fingerprintSchema?: string;
  fingerprint?: string;
  planCanonicalKey?: string;
  planVersionNumber?: number;
  addonCount?: number;
  overrideCount?: number;
  moduleCount: number;
  featureCount: number;
  specialtyCount?: number;
  limitsSummary: Array<{ key: string; state: string }>;
  cacheStatus: string;
  evaluatedAt: string;
  blockers?: Array<{ code: string }>;
};

/** Bounded explain projection — allowlisted fields only. */
export type SubscriptionRuntimeExplanation = {
  key: string;
  catalogKind?: string;
  allowed: boolean;
  code: string;
  source: 'SNAPSHOT' | 'LEGACY';
  sourceId?: string;
  snapshotId?: string;
  fingerprintSchema?: string;
  fingerprint?: string;
  planCanonicalKey?: string;
  planVersionNumber?: number;
  lifecycle?: string;
  limitState?: string;
  evaluatedAt: string;
  attribution?: Array<{ code: string; source: string; canonicalKey?: string }>;
};

export type SubscriptionRuntimeUiState =
  | 'loading'
  | 'legacy'
  | 'active_snapshot'
  | 'suspended'
  | 'cancelled'
  | 'expired'
  | 'malformed'
  | 'unsupported_schema'
  | 'cache_unavailable'
  | 'permission_denied'
  | 'rate_limited'
  | 'not_found'
  | 'error';

export const RUNTIME_UNCHANGED_WARNING =
  'Commercial configuration only. Current tenant runtime access is unchanged.';

export const STATIC_PREVIEW_WARNING =
  'Static commercial subscription preview. Tenant runtime access is unchanged.';

export const RUNTIME_DRAFT_UNCHANGED_WARNING =
  'Draft commercial changes do not alter the current tenant runtime until activation.';

export function isCommercialConfigMutable(lifecycle: string): boolean {
  return lifecycle === 'DRAFT';
}

export function subscriptionLifecycleTone(lifecycle: string): StatusTone {
  switch (lifecycle) {
    case 'ACTIVE_COMMERCIAL':
      return 'success';
    case 'DRAFT':
      return 'info';
    case 'SCHEDULED':
      return 'warning';
    case 'SUSPENDED':
      return 'warning';
    case 'CANCELLED':
    case 'EXPIRED':
    case 'SUPERSEDED':
      return 'neutral';
    default:
      return 'neutral';
  }
}

export function canScheduleSubscription(lifecycle: string): boolean {
  return lifecycle === 'DRAFT';
}

export function canActivateSubscription(lifecycle: string): boolean {
  return lifecycle === 'DRAFT' || lifecycle === 'SCHEDULED';
}

export function canSuspendSubscription(lifecycle: string): boolean {
  return lifecycle === 'ACTIVE_COMMERCIAL';
}

export function canResumeSubscription(lifecycle: string): boolean {
  return lifecycle === 'SUSPENDED';
}

export function canCancelSubscription(lifecycle: string): boolean {
  return (
    lifecycle === 'DRAFT' ||
    lifecycle === 'SCHEDULED' ||
    lifecycle === 'ACTIVE_COMMERCIAL' ||
    lifecycle === 'SUSPENDED'
  );
}

export function canSupersedeSubscription(lifecycle: string): boolean {
  return (
    lifecycle === 'DRAFT' ||
    lifecycle === 'SCHEDULED' ||
    lifecycle === 'ACTIVE_COMMERCIAL' ||
    lifecycle === 'SUSPENDED'
  );
}

export function canRenewSubscription(lifecycle: string): boolean {
  return lifecycle === 'ACTIVE_COMMERCIAL' || lifecycle === 'SUSPENDED';
}

export function classifyRuntimeHttpError(status: number): SubscriptionRuntimeUiState | null {
  if (status === 403) return 'permission_denied';
  if (status === 404) return 'not_found';
  if (status === 429) return 'rate_limited';
  return null;
}

export function classifyRuntimeInspection(
  runtime: SubscriptionRuntimeInspection,
): SubscriptionRuntimeUiState {
  const cache = runtime.cacheStatus.toUpperCase();
  if (cache === 'UNAVAILABLE' || cache === 'CACHE_UNAVAILABLE') {
    return 'cache_unavailable';
  }

  switch (runtime.code) {
    case 'runtime_suspended':
      return 'suspended';
    case 'runtime_cancelled':
      return 'cancelled';
    case 'runtime_expired':
      return 'expired';
    case 'snapshot_malformed':
    case 'snapshot_fingerprint_mismatch':
    case 'composition_conflict':
    case 'current_configuration_ambiguous':
      return 'malformed';
    case 'snapshot_unsupported_schema':
      return 'unsupported_schema';
    case 'legacy_runtime':
      return 'legacy';
    case 'snapshot_runtime':
      return 'active_snapshot';
    default:
      if (runtime.source === 'LEGACY') return 'legacy';
      if (runtime.source === 'SNAPSHOT') return 'active_snapshot';
      return 'active_snapshot';
  }
}

export function runtimeUiStateTone(state: SubscriptionRuntimeUiState): StatusTone {
  switch (state) {
    case 'active_snapshot':
      return 'success';
    case 'legacy':
      return 'info';
    case 'suspended':
    case 'cache_unavailable':
    case 'unsupported_schema':
      return 'warning';
    case 'cancelled':
    case 'expired':
    case 'malformed':
    case 'permission_denied':
    case 'rate_limited':
    case 'not_found':
    case 'error':
      return 'danger';
    case 'loading':
    default:
      return 'neutral';
  }
}

export function limitStateTone(state: string): StatusTone {
  switch (state.toUpperCase()) {
    case 'CONFIGURED':
      return 'success';
    case 'UNLIMITED':
      return 'info';
    case 'UNCONFIGURED':
      return 'warning';
    default:
      return 'neutral';
  }
}

export function cacheStatusTone(status: string): StatusTone {
  switch (status.toUpperCase()) {
    case 'HIT':
    case 'MISS':
    case 'BYPASS':
    case 'RECOMPUTED':
      return 'success';
    case 'STALE':
      return 'warning';
    case 'UNAVAILABLE':
    case 'CACHE_UNAVAILABLE':
      return 'danger';
    default:
      return 'neutral';
  }
}
