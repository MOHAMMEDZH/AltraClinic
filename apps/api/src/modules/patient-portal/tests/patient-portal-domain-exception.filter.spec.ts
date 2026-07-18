import { ArgumentsHost } from '@nestjs/common';
import { PortalDomainExceptionFilter } from '../api/patient-portal-domain-exception.filter';
import {
  PortalStateError,
  PortalValidationError,
} from '../domain/exceptions/portal-domain.exception';

describe('PortalDomainExceptionFilter', () => {
  const filter = new PortalDomainExceptionFilter();

  function hostWithResponse() {
    const json = jest.fn();
    const status = jest.fn(() => ({ json }));
    const host = {
      switchToHttp: () => ({ getResponse: () => ({ status }) }),
    } as unknown as ArgumentsHost;
    return { host, status, json };
  }

  it('maps a state error to 409 Conflict', () => {
    const { host, status } = hostWithResponse();
    filter.catch(new PortalStateError('Portal account is already active'), host);
    expect(status).toHaveBeenCalledWith(409);
  });

  it('maps a validation error to 422 Unprocessable Entity', () => {
    const { host, status } = hostWithResponse();
    filter.catch(new PortalValidationError('Patient identifier is required'), host);
    expect(status).toHaveBeenCalledWith(422);
  });

  it('does not depend on message wording for the status', () => {
    const { host, status } = hostWithResponse();
    // A state error whose message contains no conflict keywords still maps to 409.
    filter.catch(new PortalStateError('Reactivation is not permitted here'), host);
    expect(status).toHaveBeenCalledWith(409);
  });
});
