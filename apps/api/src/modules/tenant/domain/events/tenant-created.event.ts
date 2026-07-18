import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class TenantCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly branchId: string | null,
    public readonly name: string,
    public readonly domain: string | null,
  ) {
    super();
  }
}
