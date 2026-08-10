import { isValidAddOnKey } from '../platform-addons.tokens';
import {
  canTransitionAddOnLifecycle,
  canTransitionAddOnVersionLifecycle,
  isAddOnVersionMutable,
  canTransitionOverrideLifecycle,
  isOverrideMutable,
} from '../domain/addon-lifecycle';
import { composeCommercialPreview } from '../domain/commercial-composition';
import { validateAddOnLimitEffect } from '../domain/limit-effect';
import { buildAddonPublicationFingerprint } from '../domain/publication-fingerprint';

describe('Platform Add-ons domain', () => {
  it('accepts addon.* keys and rejects invalid keys', () => {
    expect(isValidAddOnKey('addon.sms_pack')).toBe(true);
    expect(isValidAddOnKey('addon.extra_storage')).toBe(true);
    expect(isValidAddOnKey('addon.SMS')).toBe(false);
    expect(isValidAddOnKey('sms_pack')).toBe(false);
    expect(isValidAddOnKey('plan.lite')).toBe(false);
  });

  it('enforces Add-on and Version lifecycle transitions', () => {
    expect(canTransitionAddOnLifecycle('DRAFT', 'ACTIVE')).toBe(true);
    expect(canTransitionAddOnLifecycle('ACTIVE', 'ARCHIVED')).toBe(true);
    expect(canTransitionAddOnLifecycle('ARCHIVED', 'ACTIVE')).toBe(true);
    expect(canTransitionAddOnVersionLifecycle('DRAFT', 'PUBLISHED')).toBe(true);
    expect(canTransitionAddOnVersionLifecycle('PUBLISHED', 'RETIRED')).toBe(true);
    expect(canTransitionAddOnVersionLifecycle('RETIRED', 'DRAFT')).toBe(false);
    expect(isAddOnVersionMutable('DRAFT')).toBe(true);
    expect(isAddOnVersionMutable('PUBLISHED')).toBe(false);
  });

  it('enforces Override maker-checker lifecycle', () => {
    expect(canTransitionOverrideLifecycle('DRAFT', 'PENDING_APPROVAL')).toBe(true);
    expect(canTransitionOverrideLifecycle('PENDING_APPROVAL', 'APPROVED')).toBe(true);
    expect(canTransitionOverrideLifecycle('PENDING_APPROVAL', 'REJECTED')).toBe(true);
    expect(canTransitionOverrideLifecycle('APPROVED', 'REVOKED')).toBe(true);
    expect(canTransitionOverrideLifecycle('APPROVED', 'DRAFT')).toBe(false);
    expect(canTransitionOverrideLifecycle('REJECTED', 'APPROVED')).toBe(false);
    expect(isOverrideMutable('DRAFT')).toBe(true);
    expect(isOverrideMutable('PENDING_APPROVAL')).toBe(false);
  });

  it('validates limit effect shapes', () => {
    expect(
      validateAddOnLimitEffect(
        { canonicalKey: 'limit.x', effectType: 'SET_UNLIMITED', unlimited: true, valueText: null },
        'LIMIT',
      ),
    ).toEqual([]);
    expect(
      validateAddOnLimitEffect(
        { canonicalKey: 'limit.x', effectType: 'INCREASE_BY', unlimited: false, valueText: '10' },
        'LIMIT',
      ),
    ).toEqual([]);
    expect(
      validateAddOnLimitEffect(
        { canonicalKey: 'module.x', effectType: 'SET_ABSOLUTE', unlimited: false, valueText: '1' },
        'MODULE',
      ).some((i) => i.code === 'limit_invalid_kind'),
    ).toBe(true);
  });

  it('builds stable publication fingerprints', () => {
    const a = buildAddonPublicationFingerprint({
      addOnCanonicalKey: 'addon.sms_pack',
      versionNumber: 1,
      sourceVersionId: null,
      translations: [
        { locale: 'ar-SY', releaseLabel: 'أ', shortDescription: 'و' },
        { locale: 'en-US', releaseLabel: 'A', shortDescription: 'b' },
      ],
      entitlements: [{ canonicalKey: 'module.billing', kind: 'MODULE' }],
      limitEffects: [
        { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '100' },
      ],
      applicabilityPlanKeys: ['plan.pro', 'plan.lite'],
    });
    const b = buildAddonPublicationFingerprint({
      addOnCanonicalKey: 'addon.sms_pack',
      versionNumber: 1,
      sourceVersionId: null,
      translations: [
        { locale: 'en-US', releaseLabel: 'A', shortDescription: 'b' },
        { locale: 'ar-SY', releaseLabel: 'أ', shortDescription: 'و' },
      ],
      entitlements: [{ canonicalKey: 'module.billing', kind: 'MODULE' }],
      limitEffects: [
        { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '100' },
      ],
      applicabilityPlanKeys: ['plan.lite', 'plan.pro'],
    });
    expect(a).toBe(b);
    expect(a).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('Commercial composition precedence', () => {
  it('applies Base → Add-ons (additive) → Overrides with limit semantics', () => {
    const result = composeCommercialPreview({
      baseEntitlements: ['module.core', 'feature.a'],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '100' }],
      addOns: [
        {
          addOnVersionId: 'av1',
          entitlements: ['feature.b', 'module.core'],
          limitEffects: [
            { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '50' },
            {
              canonicalKey: 'limit.storage',
              effectType: 'SET_ABSOLUTE',
              unlimited: false,
              valueText: '10',
            },
          ],
        },
      ],
      overrides: [
        {
          overrideId: 'ov1',
          effects: [
            { effectKind: 'ENTITLEMENT_GRANT', canonicalKey: 'feature.c', unlimited: false, valueText: null },
            {
              effectKind: 'ENTITLEMENT_SUPPRESS',
              canonicalKey: 'feature.a',
              unlimited: false,
              valueText: null,
            },
            {
              effectKind: 'LIMIT_SET_UNLIMITED',
              canonicalKey: 'limit.storage',
              unlimited: true,
              valueText: null,
            },
          ],
        },
      ],
    });

    expect(result.runtimeEffective).toBe(false);
    expect(result.entitlements).toEqual(['feature.b', 'feature.c', 'module.core']);
    expect(result.limits.find((l) => l.canonicalKey === 'limit.sms')).toEqual({
      canonicalKey: 'limit.sms',
      unlimited: false,
      valueText: '150',
    });
    expect(result.limits.find((l) => l.canonicalKey === 'limit.storage')?.unlimited).toBe(true);
    expect(result.layers.addonGrantedCount).toBe(1);
    expect(result.layers.overrideGrantedCount).toBe(1);
    expect(result.layers.overrideSuppressedCount).toBe(1);
    expect(result.disclaimer).toMatch(/LicensingEngineService/i);
  });

  it('does not allow Add-ons to remove base entitlements', () => {
    const result = composeCommercialPreview({
      baseEntitlements: ['module.core'],
      baseLimits: [],
      addOns: [{ addOnVersionId: 'av1', entitlements: [], limitEffects: [] }],
      overrides: [],
    });
    expect(result.entitlements).toEqual(['module.core']);
    expect(result.conflicts).toEqual([]);
  });

  it('is independent of Add-on and Override input order', () => {
    const base = {
      baseEntitlements: ['module.core'],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '10' }],
    };
    const a = composeCommercialPreview({
      ...base,
      addOns: [
        {
          addOnVersionId: 'av-b',
          entitlements: ['feature.b'],
          limitEffects: [
            { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '5' },
          ],
        },
        {
          addOnVersionId: 'av-a',
          entitlements: ['feature.a'],
          limitEffects: [
            { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '3' },
          ],
        },
      ],
      overrides: [],
    });
    const b = composeCommercialPreview({
      ...base,
      addOns: [
        {
          addOnVersionId: 'av-a',
          entitlements: ['feature.a'],
          limitEffects: [
            { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '3' },
          ],
        },
        {
          addOnVersionId: 'av-b',
          entitlements: ['feature.b'],
          limitEffects: [
            { canonicalKey: 'limit.sms', effectType: 'INCREASE_BY', unlimited: false, valueText: '5' },
          ],
        },
      ],
      overrides: [],
    });
    expect(a.entitlements).toEqual(b.entitlements);
    expect(a.limits).toEqual(b.limits);
    expect(a.limits.find((l) => l.canonicalKey === 'limit.sms')?.valueText).toBe('18');
  });

  it('fails closed on contradictory absolute Limits from Overrides', () => {
    const result = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '10' }],
      addOns: [],
      overrides: [
        {
          overrideId: 'ov-a',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.sms',
              unlimited: false,
              valueText: '20',
            },
          ],
        },
        {
          overrideId: 'ov-b',
          effects: [
            {
              effectKind: 'LIMIT_SET_ABSOLUTE',
              canonicalKey: 'limit.sms',
              unlimited: false,
              valueText: '30',
            },
          ],
        },
      ],
    });
    expect(result.conflicts.some((c) => c.code === 'contradictory_absolute_limits')).toBe(true);
    expect(result.entitlements).toEqual([]);
  });

  it('fails closed when Overrides both grant and suppress the same capability', () => {
    const result = composeCommercialPreview({
      baseEntitlements: ['module.core'],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: 'ov-g',
          effects: [
            {
              effectKind: 'ENTITLEMENT_GRANT',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
        {
          overrideId: 'ov-s',
          effects: [
            {
              effectKind: 'ENTITLEMENT_SUPPRESS',
              canonicalKey: 'feature.x',
              unlimited: false,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(result.conflicts.some((c) => c.code === 'contradictory_entitlement_effects')).toBe(true);
  });

  it('fails closed on negative INCREASE_BY', () => {
    const result = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '10' }],
      addOns: [
        {
          addOnVersionId: 'av1',
          entitlements: [],
          limitEffects: [
            {
              canonicalKey: 'limit.sms',
              effectType: 'INCREASE_BY',
              unlimited: false,
              valueText: '-5',
            },
          ],
        },
      ],
      overrides: [],
    });
    expect(result.conflicts.some((c) => c.code === 'negative_increase')).toBe(true);
    expect(result.entitlements).toEqual([]);
    expect(result.limits).toEqual([]);
  });

  it('fails closed on numeric overflow', () => {
    const result = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [
        { canonicalKey: 'limit.sms', unlimited: false, valueText: String(Number.MAX_SAFE_INTEGER) },
      ],
      addOns: [
        {
          addOnVersionId: 'av1',
          entitlements: [],
          limitEffects: [
            {
              canonicalKey: 'limit.sms',
              effectType: 'INCREASE_BY',
              unlimited: false,
              valueText: '1',
            },
          ],
        },
      ],
      overrides: [],
    });
    expect(result.conflicts.some((c) => c.code === 'numeric_overflow')).toBe(true);
  });

  it('fails closed on contradictory Add-on absolute Limits', () => {
    const result = composeCommercialPreview({
      baseEntitlements: [],
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '10' }],
      addOns: [
        {
          addOnVersionId: 'av-a',
          entitlements: [],
          limitEffects: [
            {
              canonicalKey: 'limit.sms',
              effectType: 'SET_ABSOLUTE',
              unlimited: false,
              valueText: '20',
            },
          ],
        },
        {
          addOnVersionId: 'av-b',
          entitlements: [],
          limitEffects: [
            {
              canonicalKey: 'limit.sms',
              effectType: 'SET_ABSOLUTE',
              unlimited: false,
              valueText: '30',
            },
          ],
        },
      ],
      overrides: [],
    });
    expect(result.conflicts.some((c) => c.code === 'contradictory_addon_absolute_limits')).toBe(
      true,
    );
  });

  it('pure compose applies all overrides — future-effective filtering is service-layer only', () => {
    // Document boundary: composeCommercialPreview has no clock; eligibility is CommercialCompositionService.
    const futureOverrideId = 'ov-future';
    const result = composeCommercialPreview({
      baseEntitlements: ['module.core'],
      baseLimits: [],
      addOns: [],
      overrides: [
        {
          overrideId: futureOverrideId,
          effects: [
            {
              effectKind: 'ENTITLEMENT_GRANT',
              canonicalKey: 'feature.future',
              unlimited: false,
              valueText: null,
            },
          ],
        },
      ],
    });
    expect(result.entitlements).toContain('feature.future');
    expect(result.conflicts).toEqual([]);
  });
});
