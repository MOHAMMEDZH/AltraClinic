/**
 * Flexible Step 27 — Platform Notifications constants.
 * Contract: docs/NOTIFICATIONS_AND_TEMPLATES.md
 */

export const PLATFORM_NOTIFICATION_PERMISSIONS = {
  templatesView: 'notifications.templates.view',
  preferencesView: 'notifications.preferences.view',
  preferencesManage: 'notifications.preferences.manage',
  deliveriesView: 'notifications.deliveries.view',
  deliveriesRetry: 'notifications.deliveries.retry',
} as const;

export const PLATFORM_NOTIFICATION_AUDIT_ACTIONS = {
  PREFERENCE_UPDATED: 'platform_notification.preference_updated',
  PREVIEW: 'platform_notification.template_previewed',
  RETRY_REQUESTED: 'platform_notification.delivery_retry_requested',
  DISPATCHED: 'platform_notification.dispatched',
  MANDATORY_DISABLE_DENIED: 'platform_notification.mandatory_disable_denied',
} as const;

export const PLATFORM_NOTIFICATION_AUDIT_CATEGORY = 'platform_notification_management';
export const PLATFORM_NOTIFICATION_PRODUCER_MODULE = 'platform.notifications.step27';
export const PLATFORM_TEMPLATE_VERSION = 'step27.v1';

/** Default `actorId` for event-driven dispatches with no human actor (audit_entries.actorId is @db.Uuid). */
export const PLATFORM_NOTIFICATION_SYSTEM_ACTOR_ID = '00000000-0000-0000-0000-000000000027';

/** UTC warning offsets (ms) before end timestamp. */
export const WARNING_WINDOWS_MS = {
  d7: 7 * 24 * 60 * 60 * 1000,
  d1: 1 * 24 * 60 * 60 * 1000,
} as const;

export const LIMIT_WARNING_RATIO = 0.8;
export const LIMIT_CRITICAL_RATIO = 0.95;

export const PLATFORM_NOTIFICATION_FAILURE_INJECTION_ENV = 'PLATFORM_NOTIFICATION_FAILURE_INJECTION';

export const PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS = [
  'template_lookup',
  'template_variable_validation',
  'template_renderer',
  'locale_renderer',
  'recipient_resolution',
  'preference_lookup',
  'mandatory_policy',
  'event_adapter',
  'intent_persist',
  'provider_transient',
  'provider_permanent',
  'provider_timeout',
  'provider_ambiguous',
  'after_provider_before_ack',
  'before_delivery_job_claim',
  'before_provider_send',
  'before_delivery_attempt_persist',
  'provider_accept_then_ack_loss',
  'audit_write',
  'retry_scheduler',
  'warning_scheduler',
  'addon_expiry_source',
  'override_expiry_source',
  'eer_limit_source',
  'usage_source',
  'compatibility_source',
  'provisioning_source',
  'trial_source',
  'subscription_source',
  'lead_reminder_source',
  'manager_recipient',
  'multi_instance_retry',
  'dead_letter_transition',
] as const;

export type PlatformNotificationFailureInjectionPoint =
  (typeof PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS)[number];

export function isPlatformNotificationFailureInjectionActive(
  point: PlatformNotificationFailureInjectionPoint | string,
): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  if (!(PLATFORM_NOTIFICATION_FAILURE_INJECTION_POINTS as readonly string[]).includes(point)) {
    return false;
  }
  return process.env[PLATFORM_NOTIFICATION_FAILURE_INJECTION_ENV] === point;
}

export const MANDATORY_PREFERENCE_CATEGORIES = new Set([
  'security',
  'lifecycle',
  'operational',
]);
