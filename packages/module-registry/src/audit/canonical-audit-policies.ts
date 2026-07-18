import { AUDIT_BUILTIN_PROVIDER_KEY, type CanonicalAuditPolicy } from './audit-types';

/** Canonical audit policies — metadata only (Phase 39a). No retention/redaction/export execution. */
export const CANONICAL_AUDIT_RETENTION_POLICIES: readonly CanonicalAuditPolicy[] = [
  {
    policyId: 'retention.hot-90d',
    policyKind: 'retention',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.retention.hot-90d',
    descriptionKey: 'audit.policy.retention.hot-90d.description',
    failClosed: true,
    compatibility: 'hot',
    sortOrder: 10,
  },
  {
    policyId: 'retention.hot-365d',
    policyKind: 'retention',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.retention.hot-365d',
    descriptionKey: 'audit.policy.retention.hot-365d.description',
    failClosed: true,
    compatibility: 'hot',
    sortOrder: 20,
  },
  {
    policyId: 'retention.warm-7y',
    policyKind: 'retention',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.retention.warm-7y',
    descriptionKey: 'audit.policy.retention.warm-7y.description',
    failClosed: true,
    compatibility: 'warm',
    sortOrder: 30,
  },
  {
    policyId: 'retention.cold-indefinite',
    policyKind: 'retention',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.retention.cold-indefinite',
    descriptionKey: 'audit.policy.retention.cold-indefinite.description',
    failClosed: true,
    compatibility: 'cold',
    sortOrder: 40,
  },
  {
    policyId: 'retention.legal-hold',
    policyKind: 'retention',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.retention.legal-hold',
    descriptionKey: 'audit.policy.retention.legal-hold.description',
    failClosed: true,
    compatibility: 'legal-hold',
    sortOrder: 50,
  },
] as const;

export const CANONICAL_AUDIT_REDACTION_POLICIES: readonly CanonicalAuditPolicy[] = [
  {
    policyId: 'redaction.standard',
    policyKind: 'redaction',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.redaction.standard',
    descriptionKey: 'audit.policy.redaction.standard.description',
    failClosed: true,
    compatibility: 'display',
    sortOrder: 10,
  },
  {
    policyId: 'redaction.phi-strict',
    policyKind: 'redaction',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.redaction.phi-strict',
    descriptionKey: 'audit.policy.redaction.phi-strict.description',
    failClosed: true,
    compatibility: 'phi',
    sortOrder: 20,
  },
  {
    policyId: 'redaction.financial-strict',
    policyKind: 'redaction',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.redaction.financial-strict',
    descriptionKey: 'audit.policy.redaction.financial-strict.description',
    failClosed: true,
    compatibility: 'financial',
    sortOrder: 30,
  },
  {
    policyId: 'redaction.security-elevated',
    policyKind: 'redaction',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.redaction.security-elevated',
    descriptionKey: 'audit.policy.redaction.security-elevated.description',
    failClosed: true,
    compatibility: 'security',
    sortOrder: 40,
  },
] as const;

export const CANONICAL_AUDIT_INTEGRITY_POLICIES: readonly CanonicalAuditPolicy[] = [
  {
    policyId: 'integrity.hash-basic',
    policyKind: 'integrity',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.integrity.hash-basic',
    descriptionKey: 'audit.policy.integrity.hash-basic.description',
    failClosed: true,
    compatibility: 'hash',
    sortOrder: 10,
  },
  {
    policyId: 'integrity.hash-chain',
    policyKind: 'integrity',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.integrity.hash-chain',
    descriptionKey: 'audit.policy.integrity.hash-chain.description',
    failClosed: true,
    compatibility: 'hash-chain',
    sortOrder: 20,
  },
  {
    policyId: 'integrity.signed-export',
    policyKind: 'integrity',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.integrity.signed-export',
    descriptionKey: 'audit.policy.integrity.signed-export.description',
    failClosed: true,
    compatibility: 'signed-export',
    sortOrder: 30,
  },
] as const;

export const CANONICAL_AUDIT_EXPORT_POLICIES: readonly CanonicalAuditPolicy[] = [
  {
    policyId: 'export.denied',
    policyKind: 'export',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.export.denied',
    descriptionKey: 'audit.policy.export.denied.description',
    failClosed: true,
    compatibility: 'none',
    sortOrder: 10,
  },
  {
    policyId: 'export.redacted',
    policyKind: 'export',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.export.redacted',
    descriptionKey: 'audit.policy.export.redacted.description',
    failClosed: true,
    compatibility: 'redacted',
    sortOrder: 20,
  },
  {
    policyId: 'export.authorized',
    policyKind: 'export',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.export.authorized',
    descriptionKey: 'audit.policy.export.authorized.description',
    failClosed: true,
    compatibility: 'authorized',
    sortOrder: 30,
  },
  {
    policyId: 'export.legal-hold-only',
    policyKind: 'export',
    providerKey: AUDIT_BUILTIN_PROVIDER_KEY,
    version: '1.0.0',
    labelKey: 'audit.policy.export.legal-hold-only',
    descriptionKey: 'audit.policy.export.legal-hold-only.description',
    failClosed: true,
    compatibility: 'legal-hold',
    sortOrder: 40,
  },
] as const;

export const CANONICAL_AUDIT_POLICIES: readonly CanonicalAuditPolicy[] = [
  ...CANONICAL_AUDIT_RETENTION_POLICIES,
  ...CANONICAL_AUDIT_REDACTION_POLICIES,
  ...CANONICAL_AUDIT_INTEGRITY_POLICIES,
  ...CANONICAL_AUDIT_EXPORT_POLICIES,
] as const;

export const CANONICAL_AUDIT_POLICY_COUNT = CANONICAL_AUDIT_POLICIES.length;
export const CANONICAL_AUDIT_POLICY_IDS = CANONICAL_AUDIT_POLICIES.map((p) => p.policyId);
export const CANONICAL_AUDIT_RETENTION_POLICY_IDS = CANONICAL_AUDIT_RETENTION_POLICIES.map((p) => p.policyId);
export const CANONICAL_AUDIT_REDACTION_POLICY_IDS = CANONICAL_AUDIT_REDACTION_POLICIES.map((p) => p.policyId);
export const CANONICAL_AUDIT_INTEGRITY_POLICY_IDS = CANONICAL_AUDIT_INTEGRITY_POLICIES.map((p) => p.policyId);
export const CANONICAL_AUDIT_EXPORT_POLICY_IDS = CANONICAL_AUDIT_EXPORT_POLICIES.map((p) => p.policyId);
