/**
 * Step 16 commercial subscription lifecycle transitions.
 * Separate from runtime SubscriptionStatus on PlatformSubscription.
 */

export type SubscriptionCommercialLifecycle =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'ACTIVE_COMMERCIAL'
  | 'SUSPENDED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'SUPERSEDED';

const ALLOWED: Record<
  SubscriptionCommercialLifecycle,
  readonly SubscriptionCommercialLifecycle[]
> = {
  DRAFT: ['SCHEDULED', 'ACTIVE_COMMERCIAL', 'CANCELLED', 'SUPERSEDED'],
  SCHEDULED: ['ACTIVE_COMMERCIAL', 'CANCELLED', 'SUPERSEDED'],
  ACTIVE_COMMERCIAL: ['SUSPENDED', 'CANCELLED', 'SUPERSEDED', 'EXPIRED'],
  SUSPENDED: ['ACTIVE_COMMERCIAL', 'CANCELLED', 'SUPERSEDED'],
  CANCELLED: [],
  EXPIRED: [],
  SUPERSEDED: [],
};

/**
 * Frozen isCurrent contract (stored, not derived):
 * - May be true: DRAFT | SCHEDULED | ACTIVE_COMMERCIAL | SUSPENDED
 * - Must be false: CANCELLED | EXPIRED | SUPERSEDED
 * - First Draft create sets current; cancel clears; supersede transfers atomically
 * - Suspend/resume keep current; schedule/activate keep or restore current
 * - Tenant may temporarily have zero current after cancel
 * - PlatformSubscriptionsService owns all current-state transitions
 */

export function canTransitionCommercialLifecycle(
  from: SubscriptionCommercialLifecycle,
  to: SubscriptionCommercialLifecycle,
): boolean {
  if (from === to) return false;
  return ALLOWED[from].includes(to);
}

export function isCommercialConfigMutable(lifecycle: SubscriptionCommercialLifecycle): boolean {
  return lifecycle === 'DRAFT';
}

export function isCurrentEligibleLifecycle(lifecycle: SubscriptionCommercialLifecycle): boolean {
  return (
    lifecycle === 'DRAFT' ||
    lifecycle === 'SCHEDULED' ||
    lifecycle === 'ACTIVE_COMMERCIAL' ||
    lifecycle === 'SUSPENDED'
  );
}

export const COMMERCIAL_RUNTIME_DISCLAIMER =
  'Commercial subscription configuration only. Tenant runtime access remains unchanged until the later runtime rollout.';

export const STATIC_PREVIEW_DISCLAIMER =
  'Static commercial subscription preview. Tenant runtime access is unchanged.';
