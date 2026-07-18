import { randomUUID } from 'crypto';
import { DomainEvent } from '../../../../common/event.base';

export class AiModelCreatedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'AiModel';
  eventId: string;
  eventName = 'AiModelCreated';
  occurredAt: string;
  tenantId: string;
  modelId: string;
  branchId?: string | null;
  nameEn: string;
  nameAr: string;
  modelType: string;
  version: string;
  createdBy: string;

  constructor(
    tenantId: string,
    modelId: string,
    nameEn: string,
    nameAr: string,
    modelType: string,
    version: string,
    createdBy: string,
    branchId?: string | null,
  ) {
    this.aggregateId = modelId;
    this.eventId = randomUUID();
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.modelId = modelId;
    this.nameEn = nameEn;
    this.nameAr = nameAr;
    this.modelType = modelType;
    this.version = version;
    this.createdBy = createdBy;
    this.branchId = branchId ?? null;
  }
}
