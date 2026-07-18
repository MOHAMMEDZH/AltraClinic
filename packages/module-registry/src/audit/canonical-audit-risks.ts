import type { CanonicalAuditRisk } from './audit-types';

/** Canonical audit risks — SSOT Phase 39 §9.2 (not interchangeable with severity). */
export const CANONICAL_AUDIT_RISKS: readonly CanonicalAuditRisk[] = [
  { risk: 'none', labelKey: 'audit.risk.none', descriptionKey: 'audit.risk.none.description', sortOrder: 10 },
  { risk: 'low', labelKey: 'audit.risk.low', descriptionKey: 'audit.risk.low.description', sortOrder: 20 },
  { risk: 'moderate', labelKey: 'audit.risk.moderate', descriptionKey: 'audit.risk.moderate.description', sortOrder: 30 },
  { risk: 'high', labelKey: 'audit.risk.high', descriptionKey: 'audit.risk.high.description', sortOrder: 40 },
  { risk: 'severe', labelKey: 'audit.risk.severe', descriptionKey: 'audit.risk.severe.description', sortOrder: 50 },
] as const;

export const CANONICAL_AUDIT_RISK_COUNT = CANONICAL_AUDIT_RISKS.length;
export const CANONICAL_AUDIT_RISK_IDS = CANONICAL_AUDIT_RISKS.map((r) => r.risk);
