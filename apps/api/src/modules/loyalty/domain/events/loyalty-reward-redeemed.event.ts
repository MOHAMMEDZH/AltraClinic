import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyRewardRedeemedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
    public readonly rewardId: string,
    public readonly description: string,
  ) {
    super();
  }
}
