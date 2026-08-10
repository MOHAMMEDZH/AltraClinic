/**
 * Deterministic catalog compatibility evaluator (not an entitlement resolver).
 */
export type RuleType =
  | 'REQUIRES'
  | 'REQUIRES_ANY_OF'
  | 'INCOMPATIBLE_WITH'
  | 'ALLOWED_FOR'
  | 'NOT_ALLOWED_FOR';

export type CatalogLifecycle = 'DRAFT' | 'ACTIVE' | 'DEPRECATED' | 'RETIRED';

export interface EvalCatalogItem {
  canonicalKey: string;
  kind: string;
  lifecycle: CatalogLifecycle;
}

export interface EvalRule {
  id: string;
  ruleType: RuleType;
  subjectKey: string;
  targetKey: string;
  anyOfGroupKey: string;
  lifecycle: CatalogLifecycle;
}

export interface CompatibilityViolation {
  reasonCode: string;
  ruleId?: string;
  subjectKey?: string;
  targetKey?: string;
  message: string;
}

export interface CompatibilityEvaluationResult {
  valid: boolean;
  violations: CompatibilityViolation[];
  warnings: CompatibilityViolation[];
  applicableRuleIds: string[];
  /** Explicit disclaimer for API/UI. */
  disclaimer: {
    notEntitlementDecision: true;
    notProvisioningDecision: true;
    notRuntimeLicenseDecision: true;
  };
}

export interface CompatibilitySelection {
  facilityTypeKey?: string;
  specialtyKeys?: string[];
  moduleKeys?: string[];
  featureKeys?: string[];
  limitKeys?: string[];
}

function indexByKey(items: EvalCatalogItem[]): Map<string, EvalCatalogItem> {
  return new Map(items.map((i) => [i.canonicalKey, i]));
}

/**
 * Precedence:
 * 1. Unknown / inactive item
 * 2. INCOMPATIBLE_WITH
 * 3. NOT_ALLOWED_FOR
 * 4. REQUIRES missing
 * 5. REQUIRES_ANY_OF missing
 * 6. ALLOWED_FOR validation
 * 7. Deprecation warnings
 */
export function evaluateCompatibilitySelection(
  selection: CompatibilitySelection,
  catalog: EvalCatalogItem[],
  rules: EvalRule[],
): CompatibilityEvaluationResult {
  const byKey = indexByKey(catalog);
  const violations: CompatibilityViolation[] = [];
  const warnings: CompatibilityViolation[] = [];
  const applicableRuleIds: string[] = [];

  const selectedKeys = [
    selection.facilityTypeKey,
    ...(selection.specialtyKeys ?? []),
    ...(selection.moduleKeys ?? []),
    ...(selection.featureKeys ?? []),
    ...(selection.limitKeys ?? []),
  ].filter((k): k is string => Boolean(k));

  for (const key of selectedKeys) {
    const item = byKey.get(key);
    if (!item) {
      violations.push({
        reasonCode: 'unknown_catalog_key',
        subjectKey: key,
        message: `Unknown catalog key: ${key}`,
      });
      continue;
    }
    if (item.lifecycle === 'DRAFT') {
      violations.push({
        reasonCode: 'draft_item_not_selectable',
        subjectKey: key,
        message: `Draft item cannot be selected: ${key}`,
      });
    } else if (item.lifecycle === 'RETIRED') {
      violations.push({
        reasonCode: 'retired_item_not_selectable',
        subjectKey: key,
        message: `Retired item cannot be newly selected: ${key}`,
      });
    } else if (item.lifecycle === 'DEPRECATED') {
      warnings.push({
        reasonCode: 'deprecated_item_selected',
        subjectKey: key,
        message: `Deprecated item selected: ${key}`,
      });
    }
  }

  const activeRules = rules
    .filter((r) => r.lifecycle === 'ACTIVE')
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id));

  const selected = new Set(selectedKeys);

  // 2. INCOMPATIBLE_WITH
  for (const rule of activeRules.filter((r) => r.ruleType === 'INCOMPATIBLE_WITH')) {
    if (selected.has(rule.subjectKey) && selected.has(rule.targetKey)) {
      applicableRuleIds.push(rule.id);
      violations.push({
        reasonCode: 'incompatible_with',
        ruleId: rule.id,
        subjectKey: rule.subjectKey,
        targetKey: rule.targetKey,
        message: `${rule.subjectKey} is incompatible with ${rule.targetKey}`,
      });
    }
  }

  // 3. NOT_ALLOWED_FOR (subject selected + target facility/specialty selected)
  for (const rule of activeRules.filter((r) => r.ruleType === 'NOT_ALLOWED_FOR')) {
    if (selected.has(rule.subjectKey) && selected.has(rule.targetKey)) {
      applicableRuleIds.push(rule.id);
      violations.push({
        reasonCode: 'not_allowed_for',
        ruleId: rule.id,
        subjectKey: rule.subjectKey,
        targetKey: rule.targetKey,
        message: `${rule.subjectKey} is not allowed for ${rule.targetKey}`,
      });
    }
  }

  // 4. REQUIRES
  for (const rule of activeRules.filter((r) => r.ruleType === 'REQUIRES')) {
    if (selected.has(rule.subjectKey) && !selected.has(rule.targetKey)) {
      applicableRuleIds.push(rule.id);
      violations.push({
        reasonCode: 'missing_required_dependency',
        ruleId: rule.id,
        subjectKey: rule.subjectKey,
        targetKey: rule.targetKey,
        message: `${rule.subjectKey} requires ${rule.targetKey}`,
      });
    }
  }

  // 5. REQUIRES_ANY_OF — group by subject+groupKey
  const anyOfGroups = new Map<string, EvalRule[]>();
  for (const rule of activeRules.filter((r) => r.ruleType === 'REQUIRES_ANY_OF')) {
    if (!selected.has(rule.subjectKey)) continue;
    const g = `${rule.subjectKey}::${rule.anyOfGroupKey || 'default'}`;
    const list = anyOfGroups.get(g) ?? [];
    list.push(rule);
    anyOfGroups.set(g, list);
  }
  for (const [, groupRules] of [...anyOfGroups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const satisfied = groupRules.some((r) => selected.has(r.targetKey));
    if (!satisfied) {
      for (const rule of groupRules) applicableRuleIds.push(rule.id);
      violations.push({
        reasonCode: 'missing_any_of_dependency',
        ruleId: groupRules[0]?.id,
        subjectKey: groupRules[0]?.subjectKey,
        message: `${groupRules[0]?.subjectKey} requires any of: ${groupRules.map((r) => r.targetKey).join(', ')}`,
      });
    } else {
      for (const rule of groupRules) {
        if (selected.has(rule.targetKey)) applicableRuleIds.push(rule.id);
      }
    }
  }

  // 6. ALLOWED_FOR — if subject has any ALLOWED_FOR rules, at least one target must be selected
  const allowedBySubject = new Map<string, EvalRule[]>();
  for (const rule of activeRules.filter((r) => r.ruleType === 'ALLOWED_FOR')) {
    if (!selected.has(rule.subjectKey)) continue;
    const list = allowedBySubject.get(rule.subjectKey) ?? [];
    list.push(rule);
    allowedBySubject.set(rule.subjectKey, list);
  }
  for (const [subject, subjectRules] of [...allowedBySubject.entries()].sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const ok = subjectRules.some((r) => selected.has(r.targetKey));
    if (!ok) {
      for (const rule of subjectRules) applicableRuleIds.push(rule.id);
      violations.push({
        reasonCode: 'allowed_for_not_satisfied',
        ruleId: subjectRules[0]?.id,
        subjectKey: subject,
        message: `${subject} is not allowed for the selected facility/specialty set`,
      });
    } else {
      for (const rule of subjectRules) {
        if (selected.has(rule.targetKey)) applicableRuleIds.push(rule.id);
      }
    }
  }

  const uniqueRuleIds = [...new Set(applicableRuleIds)].sort();
  return {
    valid: violations.length === 0,
    violations,
    warnings,
    applicableRuleIds: uniqueRuleIds,
    disclaimer: {
      notEntitlementDecision: true,
      notProvisioningDecision: true,
      notRuntimeLicenseDecision: true,
    },
  };
}

export function wouldCreateDependencyCycle(
  edges: Array<{ from: string; to: string }>,
  newFrom: string,
  newTo: string,
): boolean {
  const adj = new Map<string, string[]>();
  for (const e of edges) {
    const list = adj.get(e.from) ?? [];
    list.push(e.to);
    adj.set(e.from, list);
  }
  const list = adj.get(newFrom) ?? [];
  list.push(newTo);
  adj.set(newFrom, list);

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const next of adj.get(node) ?? []) {
      if (dfs(next)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  return dfs(newFrom);
}
