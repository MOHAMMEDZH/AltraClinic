/**
 * Phase 44b — scope catalog validation (deny unknown; no `*`).
 */

import {
  INTEGRATIONS_HIGH_RISK_SCOPES,
  INTEGRATIONS_SCOPE_CATALOG_IDS,
} from '../integrations.constants';

const ALLOWED = new Set<string>(INTEGRATIONS_SCOPE_CATALOG_IDS);
const HIGH_RISK = new Set<string>(INTEGRATIONS_HIGH_RISK_SCOPES);

export class UnknownScopeError extends Error {
  constructor(readonly unknownScopes: readonly string[]) {
    super(`Unknown or forbidden scopes: ${unknownScopes.join(', ')}`);
    this.name = 'UnknownScopeError';
  }
}

export class HighRiskScopeApprovalRequiredError extends Error {
  constructor(readonly highRiskScopes: readonly string[]) {
    super(
      `High-risk scopes require api.integrations:approve or owner: ${highRiskScopes.join(', ')}`,
    );
    this.name = 'HighRiskScopeApprovalRequiredError';
  }
}

export function validateCredentialScopes(
  scopes: readonly string[],
  options?: { allowHighRisk?: boolean },
): readonly string[] {
  const unique = [...new Set(scopes.map((s) => s.trim()).filter(Boolean))];
  if (unique.includes('*')) {
    throw new UnknownScopeError(['*']);
  }
  const unknown = unique.filter((s) => !ALLOWED.has(s));
  if (unknown.length > 0) {
    throw new UnknownScopeError(unknown);
  }
  const highRisk = unique.filter((s) => HIGH_RISK.has(s));
  if (highRisk.length > 0 && options?.allowHighRisk !== true) {
    throw new HighRiskScopeApprovalRequiredError(highRisk);
  }
  return unique;
}

/**
 * OD-MIGRATE: legacy Settings scopes read/write → ops.read only.
 * Never map to patients.* / billing.* / other PHI scopes.
 */
export function mapLegacySettingsScopesToCenter(
  legacyScopes: readonly string[],
): readonly string[] {
  void legacyScopes;
  return ['ops.read'];
}

export function isHighRiskScope(scopeId: string): boolean {
  return HIGH_RISK.has(scopeId);
}
