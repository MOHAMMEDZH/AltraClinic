import { DomainEvent } from '../../../../common/event.base';

/**
 * Analytics Domain Events
 * All analytics domain events inherit from platform's DomainEvent
 */
export abstract class AnalyticsDomainEvent extends DomainEvent {
  public readonly aggregateId: string;
  public readonly aggregateType: string;
  public readonly tenantId: string;
  public readonly version: number;

  constructor(aggregateId: string, aggregateType: string, tenantId: string, version = 1) {
    const eventId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const occurredAt = new Date().toISOString();
    super(eventId, occurredAt);
    
    this.aggregateId = aggregateId;
    this.aggregateType = aggregateType;
    this.tenantId = tenantId;
    this.version = version;
  }

  abstract eventName(): string;
  abstract toJSON(): Record<string, unknown>;
}
