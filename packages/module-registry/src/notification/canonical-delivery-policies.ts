import type { CanonicalNotificationDeliveryPolicy, NotificationDeliveryPolicyId } from './notification-types';

function definePolicy(policyId: NotificationDeliveryPolicyId, sortOrder: number): CanonicalNotificationDeliveryPolicy {
  return {
    policyId,
    labelKey: `notification.deliveryPolicy.${policyId}`,
    descriptionKey: `notification.deliveryPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification delivery policies — Phase 41a foundation vocabulary (11 policies).
 * Vocabulary-only: not a contribution kind, not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT
 * (mirrors journey guards/approvals/escalations/timers treatment in Phase 40a). failClosed: true.
 */
export const CANONICAL_NOTIFICATION_DELIVERY_POLICIES: readonly CanonicalNotificationDeliveryPolicy[] = [
  definePolicy('immediate', 10),
  definePolicy('scheduled', 20),
  definePolicy('quiet-hours-aware', 30),
  definePolicy('branch-local-time', 40),
  definePolicy('recipient-local-time', 50),
  definePolicy('batched', 60),
  definePolicy('emergency-priority', 70),
  definePolicy('manual-approval-required', 80),
  definePolicy('fallback-enabled', 90),
  definePolicy('no-fallback', 100),
  definePolicy('expiry-bounded', 110),
] as const;

export const CANONICAL_NOTIFICATION_DELIVERY_POLICY_COUNT = CANONICAL_NOTIFICATION_DELIVERY_POLICIES.length;
export const CANONICAL_NOTIFICATION_DELIVERY_POLICY_IDS = CANONICAL_NOTIFICATION_DELIVERY_POLICIES.map(
  (p) => p.policyId,
);
