import type { AddOnLimitEffectType } from '../platform-addons.tokens';

export interface LimitEffectValidationIssue {
  code: string;
  message: string;
  canonicalKey?: string;
}

export interface ProposedLimitEffect {
  canonicalKey: string;
  effectType: AddOnLimitEffectType;
  unlimited: boolean;
  valueText: string | null;
}

/**
 * Validates Add-on Limit effect shape (commercial definition only).
 * SET_UNLIMITED requires unlimited=true and null valueText.
 * SET_ABSOLUTE / INCREASE_BY require valueText when not unlimited.
 */
export function validateAddOnLimitEffect(
  proposed: ProposedLimitEffect,
  catalogKind: string | undefined,
): LimitEffectValidationIssue[] {
  const issues: LimitEffectValidationIssue[] = [];
  if (!catalogKind) {
    issues.push({
      code: 'limit_unknown_catalog_key',
      message: `Unknown Limit Catalog key: ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
    return issues;
  }
  if (catalogKind !== 'LIMIT') {
    issues.push({
      code: 'limit_invalid_kind',
      message: `Catalog item ${proposed.canonicalKey} is not a Limit.`,
      canonicalKey: proposed.canonicalKey,
    });
    return issues;
  }
  if (proposed.effectType === 'SET_UNLIMITED') {
    if (!proposed.unlimited) {
      issues.push({
        code: 'limit_unlimited_flag_required',
        message: `SET_UNLIMITED requires unlimited=true for ${proposed.canonicalKey}`,
        canonicalKey: proposed.canonicalKey,
      });
    }
    if (proposed.valueText != null) {
      issues.push({
        code: 'limit_value_and_unlimited',
        message: `SET_UNLIMITED cannot set valueText for ${proposed.canonicalKey}`,
        canonicalKey: proposed.canonicalKey,
      });
    }
    return issues;
  }
  if (proposed.unlimited) {
    issues.push({
      code: 'limit_unlimited_wrong_effect',
      message: `unlimited=true only valid with SET_UNLIMITED for ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  if (proposed.valueText == null || proposed.valueText === '') {
    issues.push({
      code: 'limit_value_required',
      message: `${proposed.effectType} requires valueText for ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  } else if (!/^-?\d+(\.\d+)?$/.test(proposed.valueText.trim())) {
    issues.push({
      code: 'limit_invalid_type',
      message: `Limit effect value must be numeric for ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  return issues;
}
