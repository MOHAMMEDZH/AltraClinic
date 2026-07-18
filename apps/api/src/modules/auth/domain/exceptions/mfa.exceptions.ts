import { BadRequestException, UnauthorizedException } from '@nestjs/common';

export class InvalidMfaCodeException extends UnauthorizedException {
  constructor() {
    super('Invalid verification code.');
  }
}

export class MfaNotConfiguredException extends BadRequestException {
  constructor() {
    super('Two-factor authentication is not configured for this account.');
  }
}

export class MfaAlreadyEnabledException extends BadRequestException {
  constructor() {
    super('Two-factor authentication is already enabled.');
  }
}
