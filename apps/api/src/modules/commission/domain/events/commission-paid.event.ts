import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class CommissionPaidEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly commissionId: string,
    public readonly providerId: string,
    public readonly branchId: string | null,
    public readonly commissionAmount: number,
    public readonly currency: string,
    public readonly status: string,
    public readonly paymentMethod: string,
    public readonly paymentReference: string | null,
    public readonly paymentDate: Date | null,
  ) {
    super();
  }
}
