import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InvoiceLineItemAddedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly description: string,
    public readonly quantity: number,
    public readonly unitPrice: number,
  ) {
    super();
  }
}
