import type { CanonicalNotificationRetentionPolicy, NotificationRetentionPolicyId } from './notification-types';

function definePolicy(
  policyId: NotificationRetentionPolicyId,
  sortOrder: number,
): CanonicalNotificationRetentionPolicy {
  return {
    policyId,
    labelKey: `notification.retentionPolicy.${policyId}`,
    descriptionKey: `notification.retentionPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification retention policies — Phase 41a foundation vocabulary (6 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_RETENTION_POLICIES: readonly CanonicalNotificationRetentionPolicy[] = [
  definePolicy('configuration-history', 10),
  definePolicy('delivery-metadata', 20),
  definePolicy('communication-history', 30),
  definePolicy('failed-delivery-metadata', 40),
  definePolicy('promotional-message', 50),
  definePolicy('compliance-retention', 60),
] as const;

export const CANONICAL_NOTIFICATION_RETENTION_POLICY_COUNT = CANONICAL_NOTIFICATION_RETENTION_POLICIES.length;
export const CANONICAL_NOTIFICATION_RETENTION_POLICY_IDS = CANONICAL_NOTIFICATION_RETENTION_POLICIES.map(
  (p) => p.policyId,
);
