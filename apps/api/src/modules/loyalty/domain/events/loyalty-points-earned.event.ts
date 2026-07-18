import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyPointsEarnedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
    public readonly pointsEarned: number,
    public readonly reason: string | null,
    public readonly reference: string | null,
  ) {
    super();
  }
}
