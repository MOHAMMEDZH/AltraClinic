import { ArgumentsHost } from '@nestjs/common';
import { PlatformAdminDomainExceptionFilter } from '../api/platform-admin-domain-exception.filter';
import { PlatformAdminStateError, PlatformAdminValidationError } from '../domain/exceptions/platform-admin.exception';

function makeHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('PlatformAdminDomainExceptionFilter', () => {
  const filter = new PlatformAdminDomainExceptionFilter();

  it('maps state errors to 409', () => {
    const { host, status, json } = makeHost();
    filter.catch(new PlatformAdminStateError('conflict'), host);
    expect(status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalled();
  });

  it('maps validation errors to 422', () => {
    const { host, status, json } = makeHost();
    filter.catch(new PlatformAdminValidationError('invalid'), host);
    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalled();
  });
});
