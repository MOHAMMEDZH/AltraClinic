import type { CanonicalNotificationRedactionPolicy, NotificationRedactionPolicyId } from './notification-types';

function definePolicy(
  policyId: NotificationRedactionPolicyId,
  sortOrder: number,
): CanonicalNotificationRedactionPolicy {
  return {
    policyId,
    labelKey: `notification.redactionPolicy.${policyId}`,
    descriptionKey: `notification.redactionPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification redaction policies — Phase 41a foundation vocabulary (7 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_REDACTION_POLICIES: readonly CanonicalNotificationRedactionPolicy[] = [
  definePolicy('no-sensitive-content', 10),
  definePolicy('minimum-necessary', 20),
  definePolicy('secure-link-only', 30),
  definePolicy('lock-screen-redacted', 40),
  definePolicy('patient-portal-required', 50),
  definePolicy('staff-secure-view', 60),
  definePolicy('phi-high-restriction', 70),
] as const;

export const CANONICAL_NOTIFICATION_REDACTION_POLICY_COUNT = CANONICAL_NOTIFICATION_REDACTION_POLICIES.length;
export const CANONICAL_NOTIFICATION_REDACTION_POLICY_IDS = CANONICAL_NOTIFICATION_REDACTION_POLICIES.map(
  (p) => p.policyId,
);
