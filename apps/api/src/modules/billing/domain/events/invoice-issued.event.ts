import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InvoiceIssuedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly patientId: string,
    public readonly amountTotal: number,
  ) {
    super();
  }
}
