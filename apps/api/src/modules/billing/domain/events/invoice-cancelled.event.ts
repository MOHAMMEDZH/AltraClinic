import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InvoiceCancelledEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly status: string,
  ) {
    super();
  }
}
