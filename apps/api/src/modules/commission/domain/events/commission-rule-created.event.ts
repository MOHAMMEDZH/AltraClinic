import { BaseDomainEvent } from '../../../../domain/events/base-domain-event';
import { CommissionRate } from '../value-objects/commission-rate.vo';

export class CommissionRuleCreatedEvent extends BaseDomainEvent {
  constructor(
    public readonly tenantId: string,
    public readonly ruleId: string,
    public readonly providerId: string | null,
    public readonly serviceType: string | null,
    public readonly commissionRate: CommissionRate,
    public readonly effectiveDate: Date,
    public readonly expiryDate: Date | null,
  ) {
    super();
  }
}
