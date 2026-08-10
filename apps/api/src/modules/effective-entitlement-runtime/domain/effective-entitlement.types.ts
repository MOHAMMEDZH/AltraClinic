/** Step 17 Effective Entitlement Runtime — typed contracts. */

export const EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA = 'effective-entitlement-runtime/v1';

export type EntitlementSource = 'SNAPSHOT' | 'LEGACY';

export type EntitlementDecision = {
  allowed: boolean;
  code: string;
  source: EntitlementSource;
  sourceId?: string;
  fingerprint?: string;
  evaluatedAt: string;
};

export type EffectiveLimit =
  | {
      state: 'CONFIGURED';
      value: string;
      valueType: string;
      code: string;
      source: EntitlementSource;
      sourceId?: string;
      fingerprint?: string;
      evaluatedAt: string;
    }
  | {
      state: 'UNLIMITED';
      code: string;
      source: EntitlementSource;
      sourceId?: string;
      fingerprint?: string;
      evaluatedAt: string;
    }
  | {
      state: 'UNCONFIGURED';
      code: string;
      source: EntitlementSource;
      sourceId?: string;
      fingerprint?: string;
      evaluatedAt: string;
    };

export type EntitlementExplanation = {
  key: string;
  catalogKind?: string;
  allowed: boolean;
  code: string;
  source: EntitlementSource;
  sourceId?: string;
  snapshotId?: string;
  fingerprintSchema?: string;
  fingerprint?: string;
  planCanonicalKey?: string;
  planVersionNumber?: number;
  lifecycle?: string;
  limitState?: string;
  evaluatedAt: string;
  attribution: Array<{ code: string; source: string; canonicalKey?: string }>;
};

export type EffectiveEntitlementBundle = {
  source: EntitlementSource;
  code: string;
  tenantId: string;
  provenance?: string;
  platformTenantId?: string;
  configId?: string;
  snapshotId?: string;
  fingerprint?: string;
  fingerprintSchema?: string;
  lifecycle?: string;
  planCanonicalKey?: string;
  planVersionNumber?: number;
  modules: string[];
  features: string[];
  specialties: string[];
  limits: Record<string, EffectiveLimit>;
  evaluatedAt: string;
  resolverSchema: typeof EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA;
};

export type SnapshotCommercialPayload = {
  schema: string;
  platformTenantId: string;
  platformSubscriptionId: string | null;
  planVersionId: string | null;
  planCanonicalKey: string;
  planVersionNumber: number;
  planPublicationFingerprint: string | null;
  addonVersionIds: string[];
  overrideIds: string[];
  commercialStart: string | null;
  commercialEnd: string | null;
  scheduledActivationAt: string | null;
  fingerprint: string;
  runtimeEffective?: boolean;
};
