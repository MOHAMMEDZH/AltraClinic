/**
 * Drift detection — compare runtime registries to catalog aliases. No mutation.
 */
import { LICENSED_MODULES, LICENSED_FEATURES } from '../../subscription/domain/config/licensing.config';

export interface DriftFinding {
  severity: 'error' | 'warning' | 'ignored';
  code: string;
  detail: string;
  reason?: string;
}

export interface DriftReport {
  generatedAt: string;
  findings: DriftFinding[];
  summary: { errors: number; warnings: number; ignored: number };
}

export interface CatalogAliasRow {
  canonicalKey: string;
  kind: string;
  aliasValue: string;
  sourceNamespace: string;
  lifecycle: string;
}

export interface CatalogItemRow {
  canonicalKey: string;
  kind: string;
  lifecycle: string;
  locales: string[];
}

const PLAN_LIMIT_KEYS = [
  'maxUsers',
  'maxDoctors',
  'maxBranches',
  'maxPatients',
  'maxAppointmentsPerMonth',
  'maxReportsPerMonth',
  'maxStorageGb',
  'maxApiRequestsPerDay',
  'maxEmailPerMonth',
  'maxSmsPerMonth',
  'maxWhatsappPerMonth',
  'maxPushPerMonth',
] as const;

export function buildCatalogDriftReport(
  items: CatalogItemRow[],
  aliases: CatalogAliasRow[],
): DriftReport {
  const findings: DriftFinding[] = [];
  const moduleAliases = new Set(
    aliases
      .filter((a) => a.sourceNamespace === 'licensed_module_id' && a.lifecycle === 'ACTIVE')
      .map((a) => a.aliasValue),
  );
  const featureAliases = new Set(
    aliases
      .filter((a) => a.sourceNamespace === 'licensed_feature_id' && a.lifecycle === 'ACTIVE')
      .map((a) => a.aliasValue),
  );
  const limitAliases = new Set(
    aliases
      .filter((a) => a.sourceNamespace === 'plan_limits_key' && a.lifecycle === 'ACTIVE')
      .map((a) => a.aliasValue),
  );

  for (const mod of LICENSED_MODULES) {
    if (!moduleAliases.has(mod.id)) {
      findings.push({
        severity: 'error',
        code: 'missing_runtime_module_alias',
        detail: mod.id,
      });
    }
  }
  for (const feat of LICENSED_FEATURES) {
    if (!featureAliases.has(feat.id)) {
      findings.push({
        severity: 'error',
        code: 'missing_runtime_feature_alias',
        detail: feat.id,
      });
    }
  }
  for (const lim of PLAN_LIMIT_KEYS) {
    if (!limitAliases.has(lim)) {
      findings.push({
        severity: 'error',
        code: 'missing_runtime_limit_alias',
        detail: lim,
      });
    }
  }

  const activeModules = items.filter((i) => i.kind === 'MODULE' && i.lifecycle === 'ACTIVE');
  for (const item of activeModules) {
    const hasAlias = aliases.some(
      (a) =>
        a.canonicalKey === item.canonicalKey &&
        a.sourceNamespace === 'licensed_module_id' &&
        a.lifecycle === 'ACTIVE',
    );
    if (!hasAlias) {
      findings.push({
        severity: 'warning',
        code: 'orphan_active_module',
        detail: item.canonicalKey,
        reason: 'Active module without licensed_module_id alias — may be future capability',
      });
    }
  }

  for (const item of items) {
    const hasEn = item.locales.includes('en-US');
    const hasAr = item.locales.includes('ar-SY');
    if (!hasEn) {
      findings.push({
        severity: 'error',
        code: 'missing_localization',
        detail: `${item.canonicalKey}:en-US`,
      });
    }
    if (!hasAr) {
      findings.push({
        severity: 'warning',
        code: 'missing_localization',
        detail: `${item.canonicalKey}:ar-SY`,
      });
    }
  }

  // Feature flags / env kill switches are intentionally ignored
  findings.push({
    severity: 'ignored',
    code: 'feature_flags_excluded',
    detail: '*_CENTER_ENABLED',
    reason: 'Operational feature flags are not commercial catalog Features',
  });

  const summary = {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    ignored: findings.filter((f) => f.severity === 'ignored').length,
  };

  return {
    generatedAt: new Date().toISOString(),
    findings,
    summary,
  };
}
