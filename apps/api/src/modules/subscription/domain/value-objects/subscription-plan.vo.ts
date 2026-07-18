import { SubscriptionDomainError } from '../exceptions/subscription-domain.exception';

/** Canonical plan names used by the system. */
export type SubscriptionPlanType = 'lite' | 'pro' | 'enterprise';

/**
 * Aliases map legacy plan names (basic/standard/premium) to canonical names.
 * Existing DB rows that still hold the old strings are transparently normalized.
 */
const PLAN_ALIASES: Record<string, SubscriptionPlanType> = {
  lite:       'lite',
  pro:        'pro',
  enterprise: 'enterprise',
  // Legacy aliases — kept for backward compat with existing data
  basic:      'lite',
  standard:   'pro',
  premium:    'enterprise',
};

export class SubscriptionPlanVO {
  readonly value: SubscriptionPlanType;

  constructor(raw: string) {
    const normalized = String(raw ?? '').trim().toLowerCase();
    const resolved = PLAN_ALIASES[normalized];
    if (!resolved) {
      throw new SubscriptionDomainError(
        `Invalid subscription plan type: "${raw}". Valid plans are: lite, pro, enterprise.`,
      );
    }
    this.value = resolved;
  }
}
