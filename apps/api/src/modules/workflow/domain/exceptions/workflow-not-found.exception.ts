import { BaseError } from '../../../../common/error.base';

export class WorkflowNotFoundError extends BaseError {
  constructor(workflowId: string) {
    super(`Workflow ${workflowId} not found`);
  }
}
