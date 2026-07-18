import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class CommissionCalculatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly commissionId: string,
    public readonly providerId: string,
    public readonly branchId: string | null,
    public readonly totalRevenue: number,
    public readonly commissionAmount: number,
    public readonly currency: string,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly basisDocumentIds: string[],
    public readonly status: string,
  ) {
    super();
  }
}
