import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class InvoiceCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly invoiceId: string,
    public readonly patientId: string,
    public readonly branchId: string | null,
    public readonly status: string,
    public readonly amountTotal: number,
  ) {
    super();
  }
}
