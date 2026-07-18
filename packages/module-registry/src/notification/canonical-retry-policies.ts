import type { CanonicalNotificationRetryPolicy, NotificationRetryPolicyId } from './notification-types';

function definePolicy(policyId: NotificationRetryPolicyId, sortOrder: number): CanonicalNotificationRetryPolicy {
  return {
    policyId,
    labelKey: `notification.retryPolicy.${policyId}`,
    descriptionKey: `notification.retryPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification retry policies — Phase 41a foundation vocabulary (6 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_RETRY_POLICIES: readonly CanonicalNotificationRetryPolicy[] = [
  definePolicy('no-retry', 10),
  definePolicy('bounded-linear', 20),
  definePolicy('bounded-exponential', 30),
  definePolicy('provider-outage', 40),
  definePolicy('transient-network', 50),
  definePolicy('manual-retry-only', 60),
] as const;

export const CANONICAL_NOTIFICATION_RETRY_POLICY_COUNT = CANONICAL_NOTIFICATION_RETRY_POLICIES.length;
export const CANONICAL_NOTIFICATION_RETRY_POLICY_IDS = CANONICAL_NOTIFICATION_RETRY_POLICIES.map((p) => p.policyId);
