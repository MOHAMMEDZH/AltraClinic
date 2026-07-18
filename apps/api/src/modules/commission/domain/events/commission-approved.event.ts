import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';

export class CommissionApprovedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly commissionId: string,
    public readonly providerId: string,
    public readonly branchId: string | null,
    public readonly commissionAmount: number,
    public readonly currency: string,
    public readonly status: string,
  ) {
    super();
  }
}
