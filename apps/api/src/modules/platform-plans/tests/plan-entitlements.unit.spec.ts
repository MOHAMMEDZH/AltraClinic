/**
 * Step 14 unit tests — Limit validation, fingerprint v2, seed inventory.
 */
import {
  buildPublicationFingerprint,
  buildPublicationFingerprintV2,
} from '../domain/publication-fingerprint';
import { validateLimitAssignment } from '../domain/limit-value.validator';
import {
  ENTITLEMENT_ELIGIBLE_KINDS,
  seededEntitlementKeysForPlan,
  seededLimitsForPlan,
  UNRESOLVED_ENTITLEMENT_MAPPINGS,
} from '../domain/plan-entitlement-seed.inventory';

describe('Step 14 plan entitlements domain', () => {
  it('entitlement-eligible kinds are MODULE and FEATURE only', () => {
    expect([...ENTITLEMENT_ELIGIBLE_KINDS]).toEqual(['MODULE', 'FEATURE']);
  });

  it('seeds exact Draft entitlement keys for lite/pro/enterprise without business', () => {
    const lite = seededEntitlementKeysForPlan('plan.lite');
    const pro = seededEntitlementKeysForPlan('plan.pro');
    const ent = seededEntitlementKeysForPlan('plan.enterprise');
    expect(lite.every((k) => k.startsWith('module.') || k.startsWith('feature.'))).toBe(true);
    expect(lite).toContain('module.dashboard');
    expect(lite).not.toContain('module.inventory'); // business minPlan
    expect(pro).toContain('module.emr');
    expect(pro).not.toContain('module.inventory');
    expect(ent).toContain('module.inventory');
    expect(ent).toContain('feature.white_label');
    expect(UNRESOLVED_ENTITLEMENT_MAPPINGS.some((u) => u.legacyIdentifier.includes('business'))).toBe(
      true,
    );
  });

  it('seeds typed Limits with Unlimited only for -1 sentinel', () => {
    const lite = seededLimitsForPlan('plan.lite');
    const enterprise = seededLimitsForPlan('plan.enterprise');
    expect(lite.find((l) => l.legacyIdentifier === 'maxUsers')).toMatchObject({
      canonicalCatalogKey: 'limit.max_users',
      unlimited: false,
      valueText: '10',
    });
    expect(enterprise.every((l) => l.unlimited && l.valueText === null)).toBe(true);
  });

  it('treats missing Limit as Unconfigured — never Unlimited without explicit flag', () => {
    const meta = {
      canonicalKey: 'limit.max_users',
      kind: 'LIMIT',
      lifecycle: 'ACTIVE',
      limitValueType: 'COUNT' as const,
      limitUnit: 'count',
      limitMin: null,
      limitMax: null,
      limitZeroValid: true,
      limitUnlimitedSupported: true,
      owningModuleCanonicalKey: null,
      owningFeatureCanonicalKey: null,
    };
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: true, valueText: '10' },
        meta,
        new Set(),
      ).some((i) => i.code === 'limit_value_and_unlimited'),
    ).toBe(true);
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: false, valueText: null },
        meta,
        new Set(),
      ).some((i) => i.code === 'limit_value_required'),
    ).toBe(true);
  });

  it('rejects fractional integers and out-of-range values', () => {
    const meta = {
      canonicalKey: 'limit.max_users',
      kind: 'LIMIT',
      lifecycle: 'ACTIVE',
      limitValueType: 'COUNT' as const,
      limitUnit: 'count',
      limitMin: '1',
      limitMax: '100',
      limitZeroValid: false,
      limitUnlimitedSupported: false,
      owningModuleCanonicalKey: 'module.user_management',
      owningFeatureCanonicalKey: null,
    };
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: false, valueText: '1.5' },
        meta,
        new Set(['module.user_management']),
      ).some((i) => i.code === 'limit_invalid_type'),
    ).toBe(true);
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: false, valueText: '0' },
        meta,
        new Set(['module.user_management']),
      ).some((i) => i.code === 'limit_zero_not_allowed'),
    ).toBe(true);
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: true, valueText: null },
        meta,
        new Set(['module.user_management']),
      ).some((i) => i.code === 'limit_unlimited_not_allowed'),
    ).toBe(true);
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' },
        meta,
        new Set(),
      ).some((i) => i.code === 'limit_owner_not_entitled'),
    ).toBe(true);
  });

  it('validates DECIMAL Catalog value type; BOOLEAN is not in Catalog enum', () => {
    const decimalMeta = {
      canonicalKey: 'limit.max_storage_gb',
      kind: 'LIMIT',
      lifecycle: 'ACTIVE',
      limitValueType: 'DECIMAL' as const,
      limitUnit: 'GB',
      limitMin: '0.5',
      limitMax: '1000',
      limitZeroValid: false,
      limitUnlimitedSupported: true,
      owningModuleCanonicalKey: null,
      owningFeatureCanonicalKey: null,
    };
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_storage_gb', unlimited: false, valueText: '12.5' },
        decimalMeta,
        new Set(),
      ),
    ).toHaveLength(0);
    expect(
      validateLimitAssignment(
        { canonicalKey: 'limit.max_storage_gb', unlimited: false, valueText: 'not-a-number' },
        decimalMeta,
        new Set(),
      ).some((i) => i.code === 'limit_invalid_type'),
    ).toBe(true);
    // Prisma HealthcareCatalogLimitValueType = INTEGER|DECIMAL|DURATION|BYTES|COUNT (no BOOLEAN).
    expect(['INTEGER', 'DECIMAL', 'DURATION', 'BYTES', 'COUNT']).not.toContain('BOOLEAN');
  });

  it('fingerprint v2 changes when entitlement or Limit changes; v1 shape preserved', () => {
    const base = {
      planCanonicalKey: 'plan.lite',
      versionNumber: 1,
      effectiveFrom: null,
      retireAt: null,
      trialDefaultEnabled: null,
      trialDefaultDays: null,
      priceAmountMinor: null,
      priceCurrency: null,
      billingInterval: null,
      billingIntervalCount: null,
      translations: [
        { locale: 'en-US', releaseLabel: 'A', shortDescription: 'B' },
        { locale: 'ar-SY', releaseLabel: 'ج', shortDescription: 'د' },
      ],
    };
    const v1 = buildPublicationFingerprint(base);
    const v2a = buildPublicationFingerprintV2({
      ...base,
      sourceVersionId: null,
      entitlements: [{ canonicalKey: 'module.dashboard', kind: 'MODULE' }],
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
    });
    const v2b = buildPublicationFingerprintV2({
      ...base,
      sourceVersionId: null,
      entitlements: [
        { canonicalKey: 'module.dashboard', kind: 'MODULE' },
        { canonicalKey: 'module.patients', kind: 'MODULE' },
      ],
      limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
    });
    const v2c = buildPublicationFingerprintV2({
      ...base,
      sourceVersionId: null,
      entitlements: [{ canonicalKey: 'module.dashboard', kind: 'MODULE' }],
      limits: [{ canonicalKey: 'limit.max_users', unlimited: true, valueText: null }],
    });
    expect(v1).not.toEqual(v2a);
    expect(v2a).not.toEqual(v2b);
    expect(v2a).not.toEqual(v2c);
    expect(
      buildPublicationFingerprintV2({
        ...base,
        sourceVersionId: null,
        entitlements: [{ canonicalKey: 'module.patients', kind: 'MODULE' }, { canonicalKey: 'module.dashboard', kind: 'MODULE' }],
        limits: [{ canonicalKey: 'limit.max_users', unlimited: false, valueText: '10' }],
      }),
    ).toEqual(v2b);
  });
});
