import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../common/event.base';

export class AiModelRetiredEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'AiModel';
  eventId: string;
  eventName = 'AiModelRetired';
  occurredAt: string;
  tenantId: string;
  modelId: string;
  retiredBy: string;

  constructor(tenantId: string, modelId: string, retiredBy: string) {
    this.aggregateId = modelId;
    this.eventId = randomUUID();
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.modelId = modelId;
    this.retiredBy = retiredBy;
  }
}
