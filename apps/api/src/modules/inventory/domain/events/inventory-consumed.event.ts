import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InventoryConsumedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly itemId: string,
    public readonly consumedQuantity: number,
    public readonly unit: string,
    public readonly sourceDocumentId: string | null,
  ) {
    super();
  }
}
