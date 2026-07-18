import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../common/event.base';

export class AiModelDeployedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'AiModel';
  eventId: string;
  eventName = 'AiModelDeployed';
  occurredAt: string;
  tenantId: string;
  modelId: string;
  deployedBy: string;

  constructor(tenantId: string, modelId: string, deployedBy: string) {
    this.aggregateId = modelId;
    this.eventId = randomUUID();
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.modelId = modelId;
    this.deployedBy = deployedBy;
  }
}
