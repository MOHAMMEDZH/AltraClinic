import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyAccountCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
    public readonly clinicId: string,
    public readonly initialPoints: number,
  ) {
    super();
  }
}
