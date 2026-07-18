import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { AiDomainError } from '../domain/exceptions/ai-domain.exception';

/**
 * Translates domain-layer {@link AiDomainError}s into HTTP responses so that
 * invariant violations surface as client errors (4xx) instead of leaking as
 * unhandled 500s. Lifecycle/state-transition violations map to 409 Conflict;
 * all other invariant breaches map to 422 Unprocessable Entity.
 */
@Catch(AiDomainError)
export class AiDomainExceptionFilter implements ExceptionFilter {
  private static readonly CONFLICT_MARKERS = [
    'already',
    'cannot be',
    'must be validated',
    'are already',
  ];

  catch(exception: AiDomainError, host: ArgumentsHost): void {
    const httpHost = host.switchToHttp();
    const response = httpHost.getResponse();

    const message = exception.message;
    const isConflict = AiDomainExceptionFilter.CONFLICT_MARKERS.some((marker) =>
      message.toLowerCase().includes(marker),
    );

    const httpException: HttpException = isConflict
      ? new ConflictException(message)
      : new UnprocessableEntityException(message);

    const status = httpException.getStatus();
    response.status(status).json(httpException.getResponse());
  }
}
