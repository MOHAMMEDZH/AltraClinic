import type { CanonicalNotificationPreferencePolicy, NotificationPreferencePolicyId } from './notification-types';

function definePolicy(
  policyId: NotificationPreferencePolicyId,
  sortOrder: number,
): CanonicalNotificationPreferencePolicy {
  return {
    policyId,
    labelKey: `notification.preferencePolicy.${policyId}`,
    descriptionKey: `notification.preferencePolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification preference policies — Phase 41a foundation vocabulary (4 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_PREFERENCE_POLICIES: readonly CanonicalNotificationPreferencePolicy[] = [
  definePolicy('channel-opt-in', 10),
  definePolicy('quiet-hours', 20),
  definePolicy('locale-preference', 30),
  definePolicy('category-opt-out', 40),
] as const;

export const CANONICAL_NOTIFICATION_PREFERENCE_POLICY_COUNT = CANONICAL_NOTIFICATION_PREFERENCE_POLICIES.length;
export const CANONICAL_NOTIFICATION_PREFERENCE_POLICY_IDS = CANONICAL_NOTIFICATION_PREFERENCE_POLICIES.map(
  (p) => p.policyId,
);
