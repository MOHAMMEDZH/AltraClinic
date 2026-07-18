import { DomainEvent } from '../../../../common/event.base';

export class SubscriptionCreatedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'Subscription';
  eventId: string;
  eventName = 'SubscriptionCreated';
  occurredAt: string;
  tenantId: string;
  branchId?: string | null;
  subscriptionId: string;
  customerId: string;
  plan: string;
  currency: string;
  createdBy: string;

  constructor(tenantId: string, subscriptionId: string, customerId: string, plan: string, currency: string, createdBy: string, branchId?: string | null) {
    this.aggregateId = subscriptionId;
    this.eventId = `${subscriptionId}-${Date.now()}`;
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.subscriptionId = subscriptionId;
    this.customerId = customerId;
    this.plan = plan;
    this.currency = currency;
    this.createdBy = createdBy;
    this.branchId = branchId ?? null;
  }
}
