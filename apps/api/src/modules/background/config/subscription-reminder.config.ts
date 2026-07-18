/** Days-before-expiry reminder schedule for subscriptions and contracts. */
export const SUBSCRIPTION_REMINDER_DAYS = [30, 14, 7, 3, 1] as const;

export type SubscriptionReminderDay = (typeof SUBSCRIPTION_REMINDER_DAYS)[number];

export const SUBSCRIPTION_REMINDER_TYPES = {
  PLATFORM_SUBSCRIPTION: 'platform-subscription',
  PLATFORM_CONTRACT: 'platform-contract',
  PLATFORM_TRIAL: 'platform-trial',
  CLINIC_SUBSCRIPTION: 'clinic-subscription',
} as const;

export type SubscriptionReminderType =
  (typeof SUBSCRIPTION_REMINDER_TYPES)[keyof typeof SUBSCRIPTION_REMINDER_TYPES];
