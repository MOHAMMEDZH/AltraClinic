import { BaseError } from '../../../../common/error.base';

export class SubscriptionDomainError extends BaseError {
  constructor(message: string) {
    super('subscription_domain_error', message);
  }
}
