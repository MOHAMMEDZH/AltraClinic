export const SUBSCRIPTION_ROUTES = [
  '/settings/subscription',
  '/settings/subscription/plans',
  '/settings/subscription/features',
  '/settings/subscription/usage',
  '/settings/subscription/ai-usage',
  '/settings/subscription/invoices',
  '/settings/subscription/payments',
  '/settings/subscription/license',
  '/settings/subscription/analytics',
  '/settings/subscription/admin',
] as const;

export type SubscriptionRoute = (typeof SUBSCRIPTION_ROUTES)[number];
