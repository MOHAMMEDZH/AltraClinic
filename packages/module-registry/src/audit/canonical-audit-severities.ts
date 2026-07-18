import type { CanonicalAuditSeverity } from './audit-types';

/** Canonical audit severities — SSOT Phase 39 §9.1. */
export const CANONICAL_AUDIT_SEVERITIES: readonly CanonicalAuditSeverity[] = [
  { severity: 'informational', labelKey: 'audit.severity.informational', descriptionKey: 'audit.severity.informational.description', sortOrder: 10 },
  { severity: 'low', labelKey: 'audit.severity.low', descriptionKey: 'audit.severity.low.description', sortOrder: 20 },
  { severity: 'medium', labelKey: 'audit.severity.medium', descriptionKey: 'audit.severity.medium.description', sortOrder: 30 },
  { severity: 'high', labelKey: 'audit.severity.high', descriptionKey: 'audit.severity.high.description', sortOrder: 40 },
  { severity: 'critical', labelKey: 'audit.severity.critical', descriptionKey: 'audit.severity.critical.description', sortOrder: 50 },
] as const;

export const CANONICAL_AUDIT_SEVERITY_COUNT = CANONICAL_AUDIT_SEVERITIES.length;
export const CANONICAL_AUDIT_SEVERITY_IDS = CANONICAL_AUDIT_SEVERITIES.map((s) => s.severity);
