import {
  ArgumentsHost,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PortalDomainError } from '../domain/exceptions/portal-domain.exception';

/**
 * Translates Patient Portal domain invariant violations into correct HTTP status
 * codes so they surface as client errors (4xx) rather than leaking as 500s.
 *
 * The status is chosen from the error's `kind` discriminator (NOT by parsing the
 * human-readable, localizable message): state conflicts → 409 Conflict; input
 * invariant breaches → 422 Unprocessable Entity.
 */
@Catch(PortalDomainError)
export class PortalDomainExceptionFilter implements ExceptionFilter {
  catch(exception: PortalDomainError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    const httpException: HttpException =
      exception.kind === 'state'
        ? new ConflictException(exception.message)
        : new UnprocessableEntityException(exception.message);

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }
}
