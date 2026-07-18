import { DomainEvent } from '../../../../common/event.base';

export class SubscriptionCanceledEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'Subscription';
  eventId: string;
  eventName = 'SubscriptionCanceled';
  occurredAt: string;
  tenantId: string;
  branchId?: string | null;
  subscriptionId: string;
  canceledBy: string;
  canceledAt: string;

  constructor(tenantId: string, subscriptionId: string, canceledBy: string, canceledAt: Date, branchId?: string | null) {
    this.aggregateId = subscriptionId;
    this.eventId = `${subscriptionId}-${Date.now()}`;
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.subscriptionId = subscriptionId;
    this.canceledBy = canceledBy;
    this.canceledAt = canceledAt.toISOString();
    this.branchId = branchId ?? null;
  }
}
