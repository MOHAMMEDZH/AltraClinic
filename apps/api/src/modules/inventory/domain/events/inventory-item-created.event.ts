import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InventoryItemCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly itemId: string,
    public readonly sku: string,
    public readonly branchId: string | null,
  ) {
    super();
  }
}
