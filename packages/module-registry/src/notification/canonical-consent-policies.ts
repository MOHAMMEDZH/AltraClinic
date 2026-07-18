import type { CanonicalNotificationConsentPolicy, NotificationConsentPolicyId } from './notification-types';

function definePolicy(policyId: NotificationConsentPolicyId, sortOrder: number): CanonicalNotificationConsentPolicy {
  return {
    policyId,
    labelKey: `notification.consentPolicy.${policyId}`,
    descriptionKey: `notification.consentPolicy.${policyId}.description`,
    sortOrder,
    failureBehavior: { strategy: 'fail-closed', failClosed: true },
  };
}

/**
 * Canonical notification consent policies — Phase 41a foundation vocabulary (6 policies).
 * Vocabulary-only: not counted in CANONICAL_NOTIFICATION_ENTRY_COUNT. failClosed: true.
 */
export const CANONICAL_NOTIFICATION_CONSENT_POLICIES: readonly CanonicalNotificationConsentPolicy[] = [
  definePolicy('transactional-necessity', 10),
  definePolicy('promotional-opt-in', 20),
  definePolicy('guardian-consent', 30),
  definePolicy('emergency-override', 40),
  definePolicy('regional-restriction', 50),
  definePolicy('revocation-aware', 60),
] as const;

export const CANONICAL_NOTIFICATION_CONSENT_POLICY_COUNT = CANONICAL_NOTIFICATION_CONSENT_POLICIES.length;
export const CANONICAL_NOTIFICATION_CONSENT_POLICY_IDS = CANONICAL_NOTIFICATION_CONSENT_POLICIES.map(
  (p) => p.policyId,
);
