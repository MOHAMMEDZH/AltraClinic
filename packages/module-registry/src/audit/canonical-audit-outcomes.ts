import type { CanonicalAuditOutcome } from './audit-types';

/** Canonical audit outcomes — SSOT Phase 39 §10.2. */
export const CANONICAL_AUDIT_OUTCOMES: readonly CanonicalAuditOutcome[] = [
  { outcomeId: 'success', labelKey: 'audit.outcome.success', descriptionKey: 'audit.outcome.success.description', sortOrder: 10 },
  { outcomeId: 'denied', labelKey: 'audit.outcome.denied', descriptionKey: 'audit.outcome.denied.description', sortOrder: 20 },
  { outcomeId: 'failed', labelKey: 'audit.outcome.failed', descriptionKey: 'audit.outcome.failed.description', sortOrder: 30 },
  { outcomeId: 'partial', labelKey: 'audit.outcome.partial', descriptionKey: 'audit.outcome.partial.description', sortOrder: 40 },
  { outcomeId: 'cancelled', labelKey: 'audit.outcome.cancelled', descriptionKey: 'audit.outcome.cancelled.description', sortOrder: 50 },
  { outcomeId: 'expired', labelKey: 'audit.outcome.expired', descriptionKey: 'audit.outcome.expired.description', sortOrder: 60 },
  { outcomeId: 'blocked', labelKey: 'audit.outcome.blocked', descriptionKey: 'audit.outcome.blocked.description', sortOrder: 70 },
] as const;

export const CANONICAL_AUDIT_OUTCOME_COUNT = CANONICAL_AUDIT_OUTCOMES.length;
export const CANONICAL_AUDIT_OUTCOME_IDS = CANONICAL_AUDIT_OUTCOMES.map((o) => o.outcomeId);
