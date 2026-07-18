import { DomainEvent } from '../../../../common/event.base';

export class WorkflowCreatedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'Workflow';
  eventId: string;
  eventName = 'WorkflowCreated';
  occurredAt: string;
  tenantId: string;
  workflowId: string;
  branchId?: string | null;
  nameEn: string;
  nameAr: string;
  createdBy: string;

  constructor(
    tenantId: string,
    workflowId: string,
    nameEn: string,
    nameAr: string,
    createdBy: string,
    branchId?: string | null,
  ) {
    this.aggregateId = workflowId;
    this.eventId = `${workflowId}-${Date.now()}`;
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.workflowId = workflowId;
    this.nameEn = nameEn;
    this.nameAr = nameAr;
    this.createdBy = createdBy;
    this.branchId = branchId ?? null;
  }
}
