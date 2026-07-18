import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyTierUpgradedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
    public readonly newTier: string,
    public readonly pointsBalance: number,
  ) {
    super();
  }
}
