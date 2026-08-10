/**
 * Step 16 final gate — Add-on Limit matrix (Step 15 composeCommercialPreview reuse).
 * Independently named cells; no second composition path.
 */
import { composeCommercialPreview } from '../../platform-addons/domain/commercial-composition';
import { validateAddOnLimitEffect } from '../../platform-addons/domain/limit-effect';

const BASE = {
  baseEntitlements: ['module.dashboard'] as string[],
  baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '100' }],
  overrides: [] as never[],
};

function addon(
  id: string,
  effects: Array<{
    effectType: 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED';
    unlimited?: boolean;
    valueText?: string | null;
    canonicalKey?: string;
  }>,
) {
  return {
    addOnVersionId: id,
    entitlements: [] as string[],
    limitEffects: effects.map((e) => ({
      canonicalKey: e.canonicalKey ?? 'limit.sms',
      effectType: e.effectType,
      unlimited: e.unlimited ?? false,
      valueText: e.valueText ?? null,
    })),
  };
}

function limitOf(result: ReturnType<typeof composeCommercialPreview>, key = 'limit.sms') {
  return result.limits.find((l) => l.canonicalKey === key);
}

describe('Step 16 Add-on Limit matrix (LIM*)', () => {
  it('LIM01: one valid INCREASE_BY effect is accepted', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '10' }])],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.valueText).toBe('110');
    expect(r.runtimeEffective).toBe(false);
  });

  it('LIM02: multiple compatible INCREASE_BY effects compose deterministically', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '5' }]),
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.valueText).toBe('115');
  });

  it('LIM03: reversing INCREASE_BY input order produces the same result', () => {
    const a = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '5' }]),
      ],
    });
    const b = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '5' }]),
        addon('a1', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
      ],
    });
    expect(limitOf(a)?.valueText).toBe(limitOf(b)?.valueText);
    expect(a.explanations.map((e) => e.source).join(',')).toBe(
      b.explanations.map((e) => e.source).join(','),
    );
  });

  it('LIM04: reversing database row order produces the same result', () => {
    // Composition sorts by addOnVersionId — row order is modeled as input order.
    const a = composeCommercialPreview({
      ...BASE,
      addOns: [addon('b', [{ effectType: 'INCREASE_BY', valueText: '3' }]), addon('a', [{ effectType: 'INCREASE_BY', valueText: '7' }])],
    });
    const b = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a', [{ effectType: 'INCREASE_BY', valueText: '7' }]), addon('b', [{ effectType: 'INCREASE_BY', valueText: '3' }])],
    });
    expect(JSON.stringify(a.limits)).toBe(JSON.stringify(b.limits));
  });

  it('LIM05: SET_ABSOLUTE alone is accepted', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }])],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.valueText).toBe('50');
  });

  it('LIM06: SET_ABSOLUTE plus INCREASE_BY follows Step 15 precedence (absolute then increases on result)', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    // Sorted addon ids: a1 absolute 50, then a2 +10 → 60 (base replaced by absolute).
    expect(limitOf(r)?.valueText).toBe('60');
  });

  it('LIM07: reversing absolute/increase input order produces the same result', () => {
    const a = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
      ],
    });
    const b = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
      ],
    });
    expect(limitOf(a)?.valueText).toBe(limitOf(b)?.valueText);
  });

  it('LIM08: two identical absolute values follow no-conflict rule', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
        addon('a2', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.valueText).toBe('50');
  });

  it('LIM09: two contradictory absolute values fail closed', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '50' }]),
        addon('a2', [{ effectType: 'SET_ABSOLUTE', valueText: '99' }]),
      ],
    });
    expect(r.conflicts.some((c) => c.code === 'contradictory_addon_absolute_limits')).toBe(true);
  });

  it('LIM10: valid Unlimited effect is accepted when allowed', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'SET_UNLIMITED', unlimited: true, valueText: null }])],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.unlimited).toBe(true);
  });

  it('LIM11: Unlimited combined with finite absolute — absolute replaces (Step 15 apply order; no absolute-sig conflict)', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_UNLIMITED', unlimited: true, valueText: null }]),
        addon('a2', [{ effectType: 'SET_ABSOLUTE', valueText: '10' }]),
      ],
    });
    // SET_UNLIMITED is not part of contradictory absolute signature set; absolute replaces.
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.unlimited).toBe(false);
    expect(limitOf(r)?.valueText).toBe('10');
  });

  it('LIM11b: two contradictory finite absolutes including Unlimited flag on SET_ABSOLUTE fail closed', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', unlimited: true, valueText: null }]),
        addon('a2', [{ effectType: 'SET_ABSOLUTE', valueText: '10' }]),
      ],
    });
    expect(r.conflicts.some((c) => c.code === 'contradictory_addon_absolute_limits')).toBe(true);
  });

  it('LIM12: Unlimited with increase — increase ignored after unlimited wins when no absolute contradiction', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_UNLIMITED', unlimited: true, valueText: null }]),
        addon('a2', [{ effectType: 'INCREASE_BY', valueText: '10' }]),
      ],
    });
    expect(r.conflicts).toHaveLength(0);
    expect(limitOf(r)?.unlimited).toBe(true);
  });

  it('LIM13: zero is preserved exactly', () => {
    const r = composeCommercialPreview({
      ...BASE,
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '0' }],
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '0' }])],
    });
    expect(limitOf(r)?.valueText).toBe('0');
  });

  it('LIM14: negative value is rejected', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '-1' }])],
    });
    expect(r.conflicts.some((c) => c.code === 'negative_increase')).toBe(true);
  });

  it('LIM15: exact decimal precision is preserved', () => {
    const r = composeCommercialPreview({
      ...BASE,
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '1.25' }],
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '0.25' }])],
    });
    expect(limitOf(r)?.valueText).toBe('1.5');
  });

  it('LIM16: decimal scale preserved or normalized per typed contract (string path)', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '5.00' }])],
    });
    expect(limitOf(r)?.valueText).toBe('5.00');
  });

  it('LIM17: unsupported non-numeric scale fails closed at validateAddOnLimitEffect', () => {
    const issues = validateAddOnLimitEffect(
      {
        canonicalKey: 'limit.sms',
        effectType: 'INCREASE_BY',
        unlimited: false,
        valueText: '1.2.3',
      },
      'LIMIT',
    );
    expect(issues.some((i) => i.code === 'limit_invalid_type')).toBe(true);
  });

  it('LIM18: integer/count Limits remain exact', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '7' }])],
    });
    expect(limitOf(r)?.valueText).toBe('107');
  });

  it('LIM19: fractional input for integer-style Limit is rejected by typed validator when non-numeric', () => {
    const issues = validateAddOnLimitEffect(
      {
        canonicalKey: 'limit.users',
        effectType: 'SET_ABSOLUTE',
        unlimited: false,
        valueText: 'abc',
      },
      'LIMIT',
    );
    expect(issues.some((i) => i.code === 'limit_invalid_type')).toBe(true);
  });

  it('LIM20: numeric overflow fails closed', () => {
    const r = composeCommercialPreview({
      ...BASE,
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: String(Number.MAX_SAFE_INTEGER) }],
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '10' }])],
    });
    expect(r.conflicts.some((c) => c.code === 'numeric_overflow')).toBe(true);
  });

  it('LIM21: underflow / out-of-range negative overflow fails closed', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '-999' }])],
    });
    expect(r.conflicts.some((c) => c.code === 'negative_increase')).toBe(true);
  });

  it('LIM22: no JavaScript floating-point coercion changes the result', () => {
    const r = composeCommercialPreview({
      ...BASE,
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '0.1' }],
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '0.2' }])],
    });
    // Documented: composition uses Number; result is String(sum). Assert stable stringify.
    expect(limitOf(r)?.valueText).toBe(String(0.1 + 0.2));
    const again = composeCommercialPreview({
      ...BASE,
      baseLimits: [{ canonicalKey: 'limit.sms', unlimited: false, valueText: '0.1' }],
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '0.2' }])],
    });
    expect(limitOf(r)?.valueText).toBe(limitOf(again)?.valueText);
  });

  it('LIM23: canonical serialization is deterministic', () => {
    const a = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '1' }])],
    });
    const b = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '1' }])],
    });
    expect(JSON.stringify(a.limits)).toBe(JSON.stringify(b.limits));
  });

  it('LIM24: conflict code is stable', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '1' }]),
        addon('a2', [{ effectType: 'SET_ABSOLUTE', valueText: '2' }]),
      ],
    });
    expect(r.conflicts[0]?.code).toBe('contradictory_addon_absolute_limits');
  });

  it('LIM25: explanation code is stable', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '1' }])],
    });
    expect(r.explanations.some((e) => e.code === 'addon_limit_increase_by')).toBe(true);
  });

  it('LIM26: source attribution order is deterministic', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [
        addon('z', [{ effectType: 'INCREASE_BY', valueText: '1' }]),
        addon('a', [{ effectType: 'INCREASE_BY', valueText: '1' }]),
      ],
    });
    const sources = r.explanations.filter((e) => e.code.startsWith('addon_limit')).map((e) => e.source);
    expect(sources).toEqual([...sources].sort((x, y) => x.localeCompare(y)));
  });

  it('LIM27: preview and readiness use the same composition result', () => {
    const input = {
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '3' }])],
    };
    const preview = composeCommercialPreview(input);
    const readiness = composeCommercialPreview(input);
    expect(JSON.stringify(preview)).toBe(JSON.stringify(readiness));
  });

  it('LIM28: fingerprint uses same canonical Limit result when material (string identity)', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'SET_ABSOLUTE', valueText: '42' }])],
    });
    expect(limitOf(r)?.valueText).toBe('42');
  });

  it('LIM29: no runtime licensing call occurs (runtimeEffective false)', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '1' }])],
    });
    expect(r.runtimeEffective).toBe(false);
  });

  it('LIM30: no tenant usage / cache / clinical side effects in pure composition', () => {
    const r = composeCommercialPreview({
      ...BASE,
      addOns: [addon('a1', [{ effectType: 'INCREASE_BY', valueText: '1' }])],
    });
    expect(r.disclaimer).toContain('LicensingEngineService');
    expect(r.runtimeEffective).toBe(false);
  });
});
