import { BaseError } from '../../../../common/error.base';

export class AiDomainError extends BaseError {
  constructor(message: string) {
    super('ai_domain_error', message);
  }
}
