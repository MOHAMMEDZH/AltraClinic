/**
 * Phase 45b — label allowlist, normalization, PHI fail-closed (OD-PHI, OD-CARDINALITY, OD-REDACTION).
 */
import {
  METRIC_FORBIDDEN_LABEL_KEYS,
  METRIC_GLOBAL_LABEL_ALLOWLIST,
  type MetricAllowedLabelKey,
  type MetricDescriptor,
  type MetricLabels,
} from '../../domain/metrics.types';

const LABEL_VALUE_PATTERN = /^[a-zA-Z0-9_.:@-]{1,64}$/;
const MAX_LABEL_VALUE_LENGTH = 64;

/** Patterns that suggest PHI / secrets in label values. */
const SENSITIVE_VALUE_PATTERNS: readonly RegExp[] = [
  /@/, // emails often; tenant_id must not use @ — tenant ids are UUIDs/slugs
  /\b\d{3}-\d{2}-\d{4}\b/,
  /bearer\s+/i,
  /bk_[a-z0-9]+/i,
  /bki_[a-z0-9]+/i,
  /password/i,
  /select\s+.+\s+from/i,
];

export type LabelValidationFailure =
  | { ok: false; reason: 'forbidden_label'; key: string }
  | { ok: false; reason: 'disallowed_label'; key: string }
  | { ok: false; reason: 'invalid_label_value'; key: string }
  | { ok: false; reason: 'phi_rejected'; key: string };

export type LabelValidationSuccess = {
  ok: true;
  labels: Record<string, string>;
  tenantId: string | null;
};

export type LabelValidationResult = LabelValidationSuccess | LabelValidationFailure;

function normalizeKey(key: string): string {
  return key.trim().toLowerCase().replace(/-/g, '_');
}

function isForbiddenKey(key: string): boolean {
  const n = normalizeKey(key);
  return (METRIC_FORBIDDEN_LABEL_KEYS as readonly string[]).includes(n);
}

function isGlobalAllowed(key: string): key is MetricAllowedLabelKey {
  return (METRIC_GLOBAL_LABEL_ALLOWLIST as readonly string[]).includes(key);
}

function valueLooksSensitive(key: string, value: string): boolean {
  if (key === 'tenant_id') {
    // Tenant ids: UUID or slug only; reject if spaces or free text.
    return !/^[a-zA-Z0-9_-]{1,64}$/.test(value);
  }
  for (const re of SENSITIVE_VALUE_PATTERNS) {
    if (re.test(value)) return true;
  }
  if (value.includes(' ') || value.includes('/') || value.includes('?')) {
    return true;
  }
  return false;
}

/**
 * Validates and normalizes labels against descriptor allowlist + global PHI rules.
 * Fail-closed on unknown/forbidden/sensitive dimensions.
 */
export function validateAndNormalizeLabels(
  descriptor: MetricDescriptor,
  input: MetricLabels | undefined,
  tenantId?: string | null,
): LabelValidationResult {
  const raw: Record<string, string> = {};
  if (input) {
    for (const [k, v] of Object.entries(input)) {
      if (v === undefined || v === null) continue;
      raw[normalizeKey(k)] = String(v).trim();
    }
  }

  if (tenantId != null && tenantId !== '') {
    raw.tenant_id = String(tenantId).trim();
  }

  // Platform-scoped metrics must not carry tenant_id.
  if (descriptor.scope === 'platform' || descriptor.scope === 'system') {
    delete raw.tenant_id;
  }

  const allowed = new Set<string>(descriptor.allowedLabels);
  // Always permit service/component for operational context when listed on descriptor.
  const out: Record<string, string> = {};

  for (const [key, value] of Object.entries(raw)) {
    if (isForbiddenKey(key)) {
      return { ok: false, reason: 'forbidden_label', key };
    }
    if (!isGlobalAllowed(key) || !allowed.has(key)) {
      return { ok: false, reason: 'disallowed_label', key };
    }
    if (value.length === 0 || value.length > MAX_LABEL_VALUE_LENGTH) {
      return { ok: false, reason: 'invalid_label_value', key };
    }
    if (!LABEL_VALUE_PATTERN.test(value) || valueLooksSensitive(key, value)) {
      return { ok: false, reason: 'phi_rejected', key };
    }
    out[key] = value;
  }

  const resolvedTenant =
    descriptor.scope === 'tenant' ? (out.tenant_id ?? null) : null;

  return { ok: true, labels: out, tenantId: resolvedTenant };
}

export function fingerprintLabels(labels: Record<string, string>): string {
  const keys = Object.keys(labels).sort();
  return keys.map((k) => `${k}=${labels[k]}`).join(',');
}
