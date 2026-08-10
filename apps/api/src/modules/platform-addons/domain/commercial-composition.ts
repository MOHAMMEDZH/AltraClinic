/**
 * Static commercial composition preview (Step 15).
 * Precedence: Base Plan Version → Add-on Versions (additive) → Overrides.
 * Does NOT call LicensingEngineService. Disclaimer: commercial definition only.
 */

export const COMPOSITION_DISCLAIMER =
  'Static commercial definition preview only. Does not resolve tenant runtime entitlements or call LicensingEngineService.';

export interface CompositionBaseLimit {
  canonicalKey: string;
  unlimited: boolean;
  valueText: string | null;
}

export interface CompositionAddonInput {
  addOnVersionId: string;
  entitlements: string[];
  limitEffects: Array<{
    canonicalKey: string;
    effectType: 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED';
    unlimited: boolean;
    valueText: string | null;
  }>;
}

export interface CompositionOverrideInput {
  overrideId: string;
  effects: Array<{
    effectKind:
      | 'ENTITLEMENT_GRANT'
      | 'ENTITLEMENT_SUPPRESS'
      | 'LIMIT_SET_ABSOLUTE'
      | 'LIMIT_INCREASE_BY'
      | 'LIMIT_SET_UNLIMITED';
    canonicalKey: string;
    unlimited: boolean;
    valueText: string | null;
  }>;
}

export interface CompositionPreviewResult {
  disclaimer: typeof COMPOSITION_DISCLAIMER;
  runtimeEffective: false;
  entitlements: string[];
  limits: CompositionBaseLimit[];
  layers: {
    baseEntitlementCount: number;
    addonGrantedCount: number;
    overrideGrantedCount: number;
    overrideSuppressedCount: number;
  };
  conflicts: Array<{ code: string; message: string; canonicalKey?: string }>;
  explanations: Array<{ code: string; canonicalKey?: string; source: string }>;
}

const SAFE_ABS_MAX = Number.MAX_SAFE_INTEGER;

function addNumeric(
  a: string | null,
  b: string | null,
): { ok: true; value: string } | { ok: false; code: 'negative_increase' | 'numeric_overflow' } {
  const na = Number(a ?? '0');
  const nb = Number(b ?? '0');
  if (!Number.isFinite(na) || !Number.isFinite(nb)) {
    return { ok: false, code: 'numeric_overflow' };
  }
  if (nb < 0) {
    return { ok: false, code: 'negative_increase' };
  }
  const sum = na + nb;
  if (!Number.isFinite(sum) || Math.abs(sum) > SAFE_ABS_MAX) {
    return { ok: false, code: 'numeric_overflow' };
  }
  if (Number.isInteger(na) && Number.isInteger(nb)) return { ok: true, value: String(sum) };
  return { ok: true, value: String(sum) };
}

/**
 * Pure composition. Add-ons are additive only (no capability removal).
 * LIMIT_SET_ABSOLUTE replaces; INCREASE_BY adds; SET_UNLIMITED wins.
 * ENTITLEMENT_SUPPRESS removes from the preview set.
 * Ambiguous same-precedence absolute Limits / grant+suppress pairs fail closed.
 */
export function composeCommercialPreview(input: {
  baseEntitlements: string[];
  baseLimits: CompositionBaseLimit[];
  addOns: CompositionAddonInput[];
  overrides: CompositionOverrideInput[];
}): CompositionPreviewResult {
  const conflicts: CompositionPreviewResult['conflicts'] = [];
  const explanations: CompositionPreviewResult['explanations'] = [];
  const entitlements = new Set(input.baseEntitlements);
  for (const key of input.baseEntitlements) {
    explanations.push({ code: 'base_entitlement', canonicalKey: key, source: 'plan_version' });
  }
  const limits = new Map<string, CompositionBaseLimit>();
  for (const l of input.baseLimits) {
    limits.set(l.canonicalKey, { ...l });
    explanations.push({
      code: l.unlimited ? 'base_limit_unlimited' : 'base_limit',
      canonicalKey: l.canonicalKey,
      source: 'plan_version',
    });
  }

  let addonGrantedCount = 0;
  const orderedAddOns = [...input.addOns].sort((a, b) =>
    a.addOnVersionId.localeCompare(b.addOnVersionId),
  );

  // Fail closed when multiple Add-ons set different absolute values for the same Limit.
  const addonAbsoluteByKey = new Map<string, Set<string>>();
  for (const addon of orderedAddOns) {
    for (const effect of addon.limitEffects) {
      if (effect.effectType !== 'SET_ABSOLUTE') continue;
      const sig = `${effect.unlimited ? 'U' : effect.valueText ?? ''}`;
      const set = addonAbsoluteByKey.get(effect.canonicalKey) ?? new Set();
      set.add(sig);
      addonAbsoluteByKey.set(effect.canonicalKey, set);
    }
  }
  for (const [key, vals] of addonAbsoluteByKey) {
    if (vals.size > 1) {
      conflicts.push({
        code: 'contradictory_addon_absolute_limits',
        message: 'Multiple Add-on Versions set different absolute values for the same Limit.',
        canonicalKey: key,
      });
    }
  }
  if (conflicts.length) {
    return {
      disclaimer: COMPOSITION_DISCLAIMER,
      runtimeEffective: false,
      entitlements: [],
      limits: [],
      layers: {
        baseEntitlementCount: input.baseEntitlements.length,
        addonGrantedCount: 0,
        overrideGrantedCount: 0,
        overrideSuppressedCount: 0,
      },
      conflicts,
      explanations,
    };
  }

  for (const addon of orderedAddOns) {
    for (const key of [...addon.entitlements].sort()) {
      if (!entitlements.has(key)) {
        entitlements.add(key);
        addonGrantedCount += 1;
        explanations.push({
          code: 'addon_entitlement',
          canonicalKey: key,
          source: addon.addOnVersionId,
        });
      }
    }
    for (const effect of [...addon.limitEffects].sort((a, b) =>
      a.canonicalKey.localeCompare(b.canonicalKey),
    )) {
      const applied = applyLimitEffect(
        limits,
        effect.canonicalKey,
        effect.effectType,
        effect.unlimited,
        effect.valueText,
      );
      if (!applied.ok) {
        conflicts.push({
          code: applied.code,
          message:
            applied.code === 'negative_increase'
              ? 'INCREASE_BY must not be negative.'
              : 'Limit numeric composition overflowed.',
          canonicalKey: effect.canonicalKey,
        });
        continue;
      }
      explanations.push({
        code: `addon_limit_${effect.effectType.toLowerCase()}`,
        canonicalKey: effect.canonicalKey,
        source: addon.addOnVersionId,
      });
    }
  }
  if (conflicts.length) {
    return {
      disclaimer: COMPOSITION_DISCLAIMER,
      runtimeEffective: false,
      entitlements: [],
      limits: [],
      layers: {
        baseEntitlementCount: input.baseEntitlements.length,
        addonGrantedCount,
        overrideGrantedCount: 0,
        overrideSuppressedCount: 0,
      },
      conflicts,
      explanations,
    };
  }

  let overrideGrantedCount = 0;
  let overrideSuppressedCount = 0;
  const orderedOverrides = [...input.overrides].sort((a, b) =>
    a.overrideId.localeCompare(b.overrideId),
  );

  // Detect contradictory absolute Limits across eligible Overrides at same key.
  const absoluteByKey = new Map<string, Set<string>>();
  const grantSuppress = new Map<string, { grant: boolean; suppress: boolean }>();
  for (const ov of orderedOverrides) {
    for (const effect of ov.effects) {
      if (effect.effectKind === 'LIMIT_SET_ABSOLUTE') {
        const sig = `${effect.unlimited ? 'U' : effect.valueText ?? ''}`;
        const set = absoluteByKey.get(effect.canonicalKey) ?? new Set();
        set.add(sig);
        absoluteByKey.set(effect.canonicalKey, set);
      }
      if (effect.effectKind === 'ENTITLEMENT_GRANT' || effect.effectKind === 'ENTITLEMENT_SUPPRESS') {
        const cur = grantSuppress.get(effect.canonicalKey) ?? { grant: false, suppress: false };
        if (effect.effectKind === 'ENTITLEMENT_GRANT') cur.grant = true;
        else cur.suppress = true;
        grantSuppress.set(effect.canonicalKey, cur);
      }
    }
  }
  for (const [key, vals] of absoluteByKey) {
    if (vals.size > 1) {
      conflicts.push({
        code: 'contradictory_absolute_limits',
        message: 'Multiple Approved Overrides set different absolute values for the same Limit.',
        canonicalKey: key,
      });
    }
  }
  for (const [key, gs] of grantSuppress) {
    if (gs.grant && gs.suppress) {
      conflicts.push({
        code: 'contradictory_entitlement_effects',
        message: 'Approved Overrides both grant and suppress the same capability.',
        canonicalKey: key,
      });
    }
  }
  if (conflicts.length) {
    return {
      disclaimer: COMPOSITION_DISCLAIMER,
      runtimeEffective: false,
      entitlements: [],
      limits: [],
      layers: {
        baseEntitlementCount: input.baseEntitlements.length,
        addonGrantedCount,
        overrideGrantedCount: 0,
        overrideSuppressedCount: 0,
      },
      conflicts,
      explanations,
    };
  }

  for (const ov of orderedOverrides) {
    for (const effect of [...ov.effects].sort((a, b) =>
      `${a.canonicalKey}:${a.effectKind}`.localeCompare(`${b.canonicalKey}:${b.effectKind}`),
    )) {
      if (effect.effectKind === 'ENTITLEMENT_GRANT') {
        if (!entitlements.has(effect.canonicalKey)) {
          entitlements.add(effect.canonicalKey);
          overrideGrantedCount += 1;
        }
        explanations.push({
          code: 'override_entitlement_grant',
          canonicalKey: effect.canonicalKey,
          source: ov.overrideId,
        });
      } else if (effect.effectKind === 'ENTITLEMENT_SUPPRESS') {
        if (entitlements.delete(effect.canonicalKey)) {
          overrideSuppressedCount += 1;
        }
        explanations.push({
          code: 'override_entitlement_suppress',
          canonicalKey: effect.canonicalKey,
          source: ov.overrideId,
        });
      } else if (effect.effectKind === 'LIMIT_SET_ABSOLUTE') {
        const applied = applyLimitEffect(
          limits,
          effect.canonicalKey,
          'SET_ABSOLUTE',
          effect.unlimited,
          effect.valueText,
        );
        if (!applied.ok) {
          conflicts.push({
            code: applied.code,
            message:
              applied.code === 'negative_increase'
                ? 'INCREASE_BY must not be negative.'
                : 'Limit numeric composition overflowed.',
            canonicalKey: effect.canonicalKey,
          });
          continue;
        }
        explanations.push({
          code: 'override_limit_absolute',
          canonicalKey: effect.canonicalKey,
          source: ov.overrideId,
        });
      } else if (effect.effectKind === 'LIMIT_INCREASE_BY') {
        const applied = applyLimitEffect(
          limits,
          effect.canonicalKey,
          'INCREASE_BY',
          effect.unlimited,
          effect.valueText,
        );
        if (!applied.ok) {
          conflicts.push({
            code: applied.code,
            message:
              applied.code === 'negative_increase'
                ? 'INCREASE_BY must not be negative.'
                : 'Limit numeric composition overflowed.',
            canonicalKey: effect.canonicalKey,
          });
          continue;
        }
        explanations.push({
          code: 'override_limit_increase',
          canonicalKey: effect.canonicalKey,
          source: ov.overrideId,
        });
      } else if (effect.effectKind === 'LIMIT_SET_UNLIMITED') {
        applyLimitEffect(limits, effect.canonicalKey, 'SET_UNLIMITED', true, null);
        explanations.push({
          code: 'override_limit_unlimited',
          canonicalKey: effect.canonicalKey,
          source: ov.overrideId,
        });
      }
    }
  }

  if (conflicts.length) {
    return {
      disclaimer: COMPOSITION_DISCLAIMER,
      runtimeEffective: false,
      entitlements: [],
      limits: [],
      layers: {
        baseEntitlementCount: input.baseEntitlements.length,
        addonGrantedCount,
        overrideGrantedCount,
        overrideSuppressedCount,
      },
      conflicts,
      explanations,
    };
  }

  return {
    disclaimer: COMPOSITION_DISCLAIMER,
    runtimeEffective: false,
    entitlements: [...entitlements].sort(),
    limits: [...limits.values()].sort((a, b) => a.canonicalKey.localeCompare(b.canonicalKey)),
    layers: {
      baseEntitlementCount: input.baseEntitlements.length,
      addonGrantedCount,
      overrideGrantedCount,
      overrideSuppressedCount,
    },
    conflicts: [],
    explanations,
  };
}

function applyLimitEffect(
  limits: Map<string, CompositionBaseLimit>,
  canonicalKey: string,
  effectType: 'SET_ABSOLUTE' | 'INCREASE_BY' | 'SET_UNLIMITED',
  unlimited: boolean,
  valueText: string | null,
): { ok: true } | { ok: false; code: 'negative_increase' | 'numeric_overflow' } {
  if (effectType === 'SET_UNLIMITED' || unlimited) {
    limits.set(canonicalKey, { canonicalKey, unlimited: true, valueText: null });
    return { ok: true };
  }
  const existing = limits.get(canonicalKey);
  if (existing?.unlimited) {
    // SET_UNLIMITED already won unless absolute replace — absolute can replace unlimited.
    if (effectType === 'SET_ABSOLUTE') {
      limits.set(canonicalKey, { canonicalKey, unlimited: false, valueText });
    }
    return { ok: true };
  }
  if (effectType === 'SET_ABSOLUTE') {
    limits.set(canonicalKey, { canonicalKey, unlimited: false, valueText });
    return { ok: true };
  }
  if (effectType === 'INCREASE_BY') {
    const base = existing?.valueText ?? '0';
    const summed = addNumeric(base, valueText);
    if (!summed.ok) return summed;
    limits.set(canonicalKey, {
      canonicalKey,
      unlimited: false,
      valueText: summed.value,
    });
  }
  return { ok: true };
}
