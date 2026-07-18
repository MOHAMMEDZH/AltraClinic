import { DomainEvent } from '../../../../common/event.base';

export class WorkflowAdvancedEvent implements DomainEvent {
  aggregateId: string;
  aggregateType = 'Workflow';
  eventId: string;
  eventName = 'WorkflowAdvanced';
  occurredAt: string;
  tenantId: string;
  workflowId: string;
  actionedBy: string;
  comment?: string | null;
  currentStepIndex: number;
  status: string;

  constructor(
    tenantId: string,
    workflowId: string,
    actionedBy: string,
    currentStepIndex: number,
    status: string,
    comment?: string | null,
  ) {
    this.aggregateId = workflowId;
    this.eventId = `${workflowId}-${Date.now()}`;
    this.occurredAt = new Date().toISOString();
    this.tenantId = tenantId;
    this.workflowId = workflowId;
    this.actionedBy = actionedBy;
    this.comment = comment ?? null;
    this.currentStepIndex = currentStepIndex;
    this.status = status;
  }
}
