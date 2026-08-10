/**
 * Pure typed Limit validation against Catalog metadata.
 * Missing assignment = Unconfigured (never Unlimited).
 */
export type LimitValueType = 'INTEGER' | 'DECIMAL' | 'DURATION' | 'BYTES' | 'COUNT' | 'BOOLEAN';

export interface CatalogLimitMeta {
  canonicalKey: string;
  kind: string;
  lifecycle: string;
  limitValueType: LimitValueType | null;
  limitUnit: string | null;
  limitMin: string | number | null;
  limitMax: string | number | null;
  limitZeroValid: boolean | null;
  limitUnlimitedSupported: boolean | null;
  owningModuleCanonicalKey: string | null;
  owningFeatureCanonicalKey: string | null;
}

export interface ProposedLimitAssignment {
  canonicalKey: string;
  unlimited: boolean;
  valueText: string | null;
}

export interface LimitValidationIssue {
  code: string;
  message: string;
  canonicalKey?: string;
}

export function validateLimitAssignment(
  proposed: ProposedLimitAssignment,
  meta: CatalogLimitMeta | undefined,
  entitledCapabilityKeys: Set<string>,
): LimitValidationIssue[] {
  const issues: LimitValidationIssue[] = [];
  if (!meta) {
    issues.push({
      code: 'limit_unknown_catalog_key',
      message: `Unknown Limit Catalog key: ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
    return issues;
  }
  if (meta.kind !== 'LIMIT') {
    issues.push({
      code: 'limit_invalid_kind',
      message: `Catalog item ${proposed.canonicalKey} is not a Limit.`,
      canonicalKey: proposed.canonicalKey,
    });
    return issues;
  }
  if (meta.lifecycle === 'RETIRED') {
    issues.push({
      code: 'limit_retired_item',
      message: `Retired Limit cannot be assigned: ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  if (proposed.unlimited && proposed.valueText != null) {
    issues.push({
      code: 'limit_value_and_unlimited',
      message: `Limit ${proposed.canonicalKey} cannot set both value and Unlimited.`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  if (!proposed.unlimited && (proposed.valueText == null || proposed.valueText === '')) {
    issues.push({
      code: 'limit_value_required',
      message: `Limit ${proposed.canonicalKey} requires a typed value when not Unlimited.`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  if (proposed.unlimited && meta.limitUnlimitedSupported === false) {
    issues.push({
      code: 'limit_unlimited_not_allowed',
      message: `Unlimited not allowed for ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  if (!proposed.unlimited && proposed.valueText != null) {
    const vt = meta.limitValueType ?? 'COUNT';
    const raw = proposed.valueText.trim();
    if (vt === 'BOOLEAN') {
      if (raw !== 'true' && raw !== 'false') {
        issues.push({
          code: 'limit_invalid_type',
          message: `Boolean Limit ${proposed.canonicalKey} must be true or false.`,
          canonicalKey: proposed.canonicalKey,
        });
      }
    } else if (vt === 'INTEGER' || vt === 'COUNT' || vt === 'BYTES' || vt === 'DURATION') {
      if (!/^-?\d+$/.test(raw)) {
        issues.push({
          code: 'limit_invalid_type',
          message: `Integer Limit ${proposed.canonicalKey} must be a whole number.`,
          canonicalKey: proposed.canonicalKey,
        });
      } else {
        const n = Number(raw);
        if (n < 0 && meta.limitMin == null) {
          issues.push({
            code: 'limit_negative_not_allowed',
            message: `Negative value not allowed for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
        if (n === 0 && meta.limitZeroValid === false) {
          issues.push({
            code: 'limit_zero_not_allowed',
            message: `Zero not allowed for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
        if (meta.limitMin != null && n < Number(meta.limitMin)) {
          issues.push({
            code: 'limit_out_of_range',
            message: `Value below minimum for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
        if (meta.limitMax != null && n > Number(meta.limitMax)) {
          issues.push({
            code: 'limit_out_of_range',
            message: `Value above maximum for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
      }
    } else if (vt === 'DECIMAL') {
      if (!/^-?\d+(\.\d+)?$/.test(raw)) {
        issues.push({
          code: 'limit_invalid_type',
          message: `Decimal Limit ${proposed.canonicalKey} must be a decimal string.`,
          canonicalKey: proposed.canonicalKey,
        });
      } else {
        const n = Number(raw);
        if (n === 0 && meta.limitZeroValid === false) {
          issues.push({
            code: 'limit_zero_not_allowed',
            message: `Zero not allowed for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
        if (meta.limitMin != null && n < Number(meta.limitMin)) {
          issues.push({
            code: 'limit_out_of_range',
            message: `Value below minimum for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
        if (meta.limitMax != null && n > Number(meta.limitMax)) {
          issues.push({
            code: 'limit_out_of_range',
            message: `Value above maximum for ${proposed.canonicalKey}`,
            canonicalKey: proposed.canonicalKey,
          });
        }
      }
    } else {
      issues.push({
        code: 'limit_invalid_type',
        message: `Unsupported Limit value type for ${proposed.canonicalKey}`,
        canonicalKey: proposed.canonicalKey,
      });
    }
  }

  const owner =
    meta.owningModuleCanonicalKey ?? meta.owningFeatureCanonicalKey ?? null;
  if (owner && !entitledCapabilityKeys.has(owner)) {
    issues.push({
      code: 'limit_owner_not_entitled',
      message: `Owning capability ${owner} is not entitled for Limit ${proposed.canonicalKey}`,
      canonicalKey: proposed.canonicalKey,
    });
  }
  return issues;
}
