import { SubscriptionDomainError } from '../exceptions/subscription-domain.exception';

export type SubscriptionStatusType = 'active' | 'canceled' | 'past_due' | 'trial' | 'expired';

export class SubscriptionStatusVO {
  constructor(public readonly value: SubscriptionStatusType) {
    const normalized = String(value ?? '').trim().toLowerCase() as SubscriptionStatusType;
    if (!['active', 'canceled', 'past_due', 'trial', 'expired'].includes(normalized)) {
      throw new SubscriptionDomainError('Invalid subscription status');
    }
    this.value = normalized;
  }
}
