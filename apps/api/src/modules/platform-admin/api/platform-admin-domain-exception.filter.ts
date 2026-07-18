import { ArgumentsHost, Catch, ConflictException, ExceptionFilter, HttpException, UnprocessableEntityException } from '@nestjs/common';
import { PlatformAdminError } from '../domain/exceptions/platform-admin.exception';

/**
 * Translates Super Admin Platform domain invariant violations into correct HTTP
 * status codes so they surface as client errors (4xx) rather than leaking as
 * 500s.
 *
 * The status is chosen from the error's `kind` discriminator (NOT by parsing the
 * human-readable, localizable message): state conflicts → 409 Conflict; input or
 * business-rule breaches (including separation-of-duties) → 422 Unprocessable
 * Entity.
 */
@Catch(PlatformAdminError)
export class PlatformAdminDomainExceptionFilter implements ExceptionFilter {
  catch(exception: PlatformAdminError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse();

    const httpException: HttpException =
      exception.kind === 'state'
        ? new ConflictException(exception.message)
        : new UnprocessableEntityException(exception.message);

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }
}
