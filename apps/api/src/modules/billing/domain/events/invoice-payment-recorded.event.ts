import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InvoicePaymentRecordedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly amount: number,
    public readonly paymentMethod: string,
    public readonly paymentReference: string | null,
    public readonly status: string,
  ) {
    super();
  }
}
