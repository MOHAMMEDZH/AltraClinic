/**
 * Step 17 unit evidence — snapshot validation, canonical keys, limit semantics.
 * No database required.
 */
import { createHash } from 'crypto';
import {
  computeSubscriptionCommercialFingerprint,
  SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
} from '../../platform-subscriptions/domain/subscription-commercial-fingerprint';
import { composeCommercialPreview } from '../../platform-addons/domain/commercial-composition';
import {
  catalogKeyToLicensedFeatureId,
  catalogKeyToLicensedModuleId,
  normalizeCanonicalKey,
  validateCommercialSnapshotPayload,
} from '../domain/snapshot-validation';
import { EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA } from '../domain/effective-entitlement.types';
import { buildEffectiveEntitlementCacheKey } from '../application/effective-entitlement.cache';

function validPayload(overrides: Record<string, unknown> = {}) {
  const base = {
    platformTenantId: 'pt-1',
    platformSubscriptionId: null as string | null,
    planCanonicalKey: 'plan.pro',
    planVersionId: 'pv-1',
    planVersionNumber: 1,
    planPublicationFingerprint: 'pub-fp',
    addonVersionIds: [] as string[],
    addonFingerprints: [] as string[],
    overrideIds: [] as string[],
    overrideFingerprints: [] as string[],
    commercialStart: null as string | null,
    commercialEnd: null as string | null,
    scheduledActivationAt: null as string | null,
  };
  const fingerprint = computeSubscriptionCommercialFingerprint(base);
  return {
    schema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
    platformTenantId: base.platformTenantId,
    platformSubscriptionId: base.platformSubscriptionId,
    planVersionId: base.planVersionId,
    planCanonicalKey: base.planCanonicalKey,
    planVersionNumber: base.planVersionNumber,
    planPublicationFingerprint: base.planPublicationFingerprint,
    addonVersionIds: base.addonVersionIds,
    overrideIds: base.overrideIds,
    commercialStart: base.commercialStart,
    commercialEnd: base.commercialEnd,
    scheduledActivationAt: base.scheduledActivationAt,
    fingerprint,
    runtimeEffective: false,
    ...overrides,
  };
}

describe('Step 17 snapshot-validation (unit)', () => {
  it('accepts a well-formed commercial snapshot payload', () => {
    const payload = validPayload();
    const result = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: payload.fingerprint as string,
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.payload.planCanonicalKey).toBe('plan.pro');
      expect(result.payload.runtimeEffective).toBe(false);
    }
  });

  it('fail-closes on malformed / non-object payload', () => {
    for (const payload of [null, undefined, 'x', 1, []]) {
      const result = validateCommercialSnapshotPayload({
        platformTenantId: 'pt-1',
        configId: 'cfg-1',
        storedFingerprint: 'a'.repeat(64),
        storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
        payload,
      });
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.code).toBe('snapshot_malformed');
    }
  });

  it('fail-closes on fingerprint mismatch (no silent legacy)', () => {
    const payload = validPayload();
    const result = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: 'b'.repeat(64),
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('snapshot_fingerprint_mismatch');
  });

  it('fail-closes on unsupported schema', () => {
    const payload = validPayload({ schema: 'other/v0' });
    const result = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: (payload.fingerprint as string) ?? 'c'.repeat(64),
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('snapshot_unsupported_schema');
  });

  it('rejects plan.business and tenant mismatch', () => {
    const biz = validPayload({ planCanonicalKey: 'plan.business' });
    const bizResult = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: biz.fingerprint as string,
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload: biz,
    });
    expect(bizResult.ok).toBe(false);
    if (!bizResult.ok) expect(bizResult.code).toBe('snapshot_plan_business_rejected');

    const payload = validPayload();
    const mismatch = validateCommercialSnapshotPayload({
      platformTenantId: 'other-tenant',
      configId: 'cfg-1',
      storedFingerprint: payload.fingerprint as string,
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(mismatch.ok).toBe(false);
    if (!mismatch.ok) expect(mismatch.code).toBe('snapshot_tenant_mismatch');
  });

  it('rejects prohibited payload fields', () => {
    const payload = validPayload({ billing: { secret: true } });
    const result = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: payload.fingerprint as string,
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('snapshot_prohibited_field');
  });

  it('rejects duplicate addon / override ids', () => {
    const payload = validPayload({ addonVersionIds: ['a1', 'a1'] });
    const result = validateCommercialSnapshotPayload({
      platformTenantId: 'pt-1',
      configId: 'cfg-1',
      storedFingerprint: payload.fingerprint as string,
      storedSchema: SUBSCRIPTION_COMMERCIAL_FINGERPRINT_SCHEMA,
      payload,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('snapshot_duplicate_addon');
  });
});

describe('Step 17 canonical key normalize (unit)', () => {
  it('trims and accepts stable keys; rejects empty / whitespace-bearing', () => {
    expect(normalizeCanonicalKey('  module.dashboard  ')).toBe('module.dashboard');
    expect(normalizeCanonicalKey('')).toBeNull();
    expect(normalizeCanonicalKey('   ')).toBeNull();
    expect(normalizeCanonicalKey('module.dash board')).toBeNull();
  });

  it('maps catalog module/feature suffixes to licensed ids', () => {
    expect(catalogKeyToLicensedModuleId('module.patient_portal')).toBe('patientPortal');
    expect(catalogKeyToLicensedModuleId('feature.x')).toBeNull();
    expect(catalogKeyToLicensedFeatureId('feature.online_booking')).toBe('onlineBooking');
    expect(catalogKeyToLicensedFeatureId('module.x')).toBeNull();
  });
});

describe('Step 17 limit UNCONFIGURED vs UNLIMITED semantics (unit)', () => {
  /**
   * Runtime maps composeCommercialPreview outcomes:
   * unlimited → UNLIMITED; missing/empty value → UNCONFIGURED; never treat missing as unlimited.
   */
  it('treats unlimited composition as UNLIMITED and missing value as UNCONFIGURED', () => {
    const unlimited = composeCommercialPreview({
      baseEntitlements: ['module.dashboard'],
      baseLimits: [{ canonicalKey: 'limit.max_users', unlimited: true, valueText: null }],
      addOns: [],
      overrides: [],
    });
    expect(unlimited.conflicts).toHaveLength(0);
    const u = unlimited.limits.find((l) => l.canonicalKey === 'limit.max_users');
    expect(u?.unlimited).toBe(true);
    expect(u?.valueText == null || u?.valueText === '').toBe(true);

    const configured = composeCommercialPreview({
      baseEntitlements: ['module.dashboard'],
      baseLimits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
      addOns: [],
      overrides: [],
    });
    const c = configured.limits.find((l) => l.canonicalKey === 'limit.max_users');
    expect(c?.unlimited).toBe(false);
    expect(c?.valueText).toBe('10');

    // Absent limit key is UNCONFIGURED at runtime — not present in composition output.
    expect(configured.limits.find((l) => l.canonicalKey === 'limit.max_storage_gb')).toBeUndefined();
  });

  it('SET_UNLIMITED override is distinct from absent limit', () => {
    const r = composeCommercialPreview({
      baseEntitlements: ['module.dashboard'],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '5' }],
      addOns: [],
      overrides: [
        {
          overrideId: 'o1',
          effects: [
            {
              effectKind: 'LIMIT_SET_UNLIMITED',
              canonicalKey: 'limit.sms',
              unlimited: true,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    const sms = r.limits.find((l) => l.canonicalKey === 'limit.sms');
    expect(sms?.unlimited).toBe(true);
    expect(r.limits.find((l) => l.canonicalKey === 'limit.absent')).toBeUndefined();
  });
});

describe('Step 17 cache key isolation shape (unit)', () => {
  it('namespaces keys under resolver schema and isolates tenant/provenance/source/snapshot/fingerprint', () => {
    const a = buildEffectiveEntitlementCacheKey({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const b = buildEffectiveEntitlementCacheKey({
      tenantId: 't2',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's1',
      fingerprint: 'f1',
    });
    const legacy = buildEffectiveEntitlementCacheKey({
      tenantId: 't1',
      provenance: 'NEVER_MANAGED',
      source: 'LEGACY',
    });
    expect(a.startsWith(`${EFFECTIVE_ENTITLEMENT_RESOLVER_SCHEMA}|`)).toBe(true);
    expect(a).not.toBe(b);
    expect(a).not.toBe(legacy);
    expect(legacy).toContain('|NEVER_MANAGED|LEGACY|none|none|none');
    const afterActivation = buildEffectiveEntitlementCacheKey({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's2',
      fingerprint: 'f2',
    });
    expect(afterActivation).not.toBe(a);
  });

  it('does not use unstable hash of wall-clock for key identity', () => {
    const key = buildEffectiveEntitlementCacheKey({
      tenantId: 't1',
      provenance: 'AUTHORITATIVE_ACTIVE',
      source: 'SNAPSHOT',
      snapshotId: 's1',
      fingerprint: createHash('sha256').update('x').digest('hex'),
    });
    expect(key.split('|')).toHaveLength(7);
  });
});
