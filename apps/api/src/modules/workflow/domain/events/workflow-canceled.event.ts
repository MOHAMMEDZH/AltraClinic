import { DomainEvent } from '../../../../common/event.base';

export class WorkflowCanceledEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'Workflow';
  eventId: string;
  eventName = 'WorkflowCanceled';
  occurredAt: string;
  tenantId: string;
  workflowId: string;
  canceledBy: string;
  canceledAt: string;
  reason?: string | null;

  constructor(tenantId: string, workflowId: string, canceledBy: string, canceledAt: Date, reason?: string | null) {
    this.aggregateId = workflowId;
    this.eventId = `${workflowId}-${Date.now()}`;
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.workflowId = workflowId;
    this.canceledBy = canceledBy;
    this.canceledAt = canceledAt.toISOString();
    this.reason = reason ?? null;
  }
}
