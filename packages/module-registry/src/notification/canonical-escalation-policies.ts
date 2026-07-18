import type { CanonicalNotificationEscalationPolicy, NotificationEscalationPolicyId } from './notification-types';

function definePolicy(
  policyId: NotificationEscalationPolicyId,
  sortOrder: number,
): CanonicalNotificationEscalationPolicy {
  return {
    policyId,
    labelKey: `notification.escalationPolicy.${policyId}`,
    descriptionKey: `notification.escalationPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification escalation policies — Phase 41a foundation vocabulary (4 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_ESCALATION_POLICIES: readonly CanonicalNotificationEscalationPolicy[] = [
  definePolicy('none', 10),
  definePolicy('staff-notify', 20),
  definePolicy('manager-escalate', 30),
  definePolicy('ops-alert', 40),
] as const;

export const CANONICAL_NOTIFICATION_ESCALATION_POLICY_COUNT = CANONICAL_NOTIFICATION_ESCALATION_POLICIES.length;
export const CANONICAL_NOTIFICATION_ESCALATION_POLICY_IDS = CANONICAL_NOTIFICATION_ESCALATION_POLICIES.map(
  (p) => p.policyId,
);
