import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class LoyaltyAccountSuspendedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly accountId: string,
    public readonly patientId: string,
  ) {
    super();
  }
}
