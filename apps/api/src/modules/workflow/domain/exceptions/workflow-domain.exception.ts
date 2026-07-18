import { BaseError } from '../../../../common/error.base';

export class WorkflowDomainError extends BaseError {
  constructor(message: string) {
    super('workflow_domain_error', message);
  }
}
