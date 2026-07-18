import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyPointsRedeemedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
    public readonly pointsRedeemed: number,
    public readonly reference: string | null,
  ) {
    super();
  }
}
