import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class UserRegisteredEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly userId: string,
    public readonly email: string,
    public readonly roles: string[],
  ) {
    super();
  }
}
