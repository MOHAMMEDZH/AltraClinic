import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../common/event.base';

export class AiModelValidatedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'AiModel';
  eventId: string;
  eventName = 'AiModelValidated';
  occurredAt: string;
  tenantId: string;
  modelId: string;
  validatedBy: string;
  notes?: string | null;

  constructor(tenantId: string, modelId: string, validatedBy: string, notes?: string | null) {
    this.aggregateId = modelId;
    this.eventId = randomUUID();
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.modelId = modelId;
    this.validatedBy = validatedBy;
    this.notes = notes ?? null;
  }
}
