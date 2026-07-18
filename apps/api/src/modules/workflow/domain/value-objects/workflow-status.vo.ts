import { WorkflowDomainError } from '../exceptions/workflow-domain.exception';

const ALLOWED_STATUSES = ['active', 'completed', 'canceled'] as const;

type WorkflowStatusValue = (typeof ALLOWED_STATUSES)[number];

export class WorkflowStatusVO {
  public readonly value: WorkflowStatusValue;

  constructor(value: string) {
    const normalized = String(value ?? '').trim().toLowerCase();
    if (!ALLOWED_STATUSES.includes(normalized as WorkflowStatusValue)) {
      throw new WorkflowDomainError(`Workflow status '${value}' is invalid`);
    }

    this.value = normalized as WorkflowStatusValue;
  }
}
