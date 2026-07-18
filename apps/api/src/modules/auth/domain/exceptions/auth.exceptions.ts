import { UnauthorizedException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';

export class InvalidCredentialsException extends UnauthorizedException {
  constructor() {
    // Deliberately generic — don't reveal which field is wrong
    super('Invalid email or password.');
  }
}

export class AccountLockedException extends ForbiddenException {
  constructor(lockedUntil: Date) {
    // Return approximate minutes remaining — never expose exact timestamps (timing oracle)
    const minutesLeft = Math.max(1, Math.ceil((lockedUntil.getTime() - Date.now()) / 60_000));
    super(`Account is temporarily locked. Try again in approximately ${minutesLeft} minute(s).`);
  }
}

export class AccountInactiveException extends ForbiddenException {
  constructor() {
    super('Your account has been deactivated. Contact your administrator.');
  }
}

export class EmailNotVerifiedException extends ForbiddenException {
  constructor() {
    super('Please verify your email address before logging in.');
  }
}

export class TokenExpiredException extends UnauthorizedException {
  constructor(tokenType: string) {
    super(`${tokenType} token has expired.`);
  }
}

export class TokenInvalidException extends UnauthorizedException {
  constructor(tokenType: string) {
    super(`${tokenType} token is invalid or has been revoked.`);
  }
}

export class PasswordPolicyViolationException extends BadRequestException {
  constructor(violations: string[]) {
    super({ message: 'Password does not meet policy requirements.', violations });
  }
}

/**
 * RFC 6585 — rate limit responses MUST be HTTP 429 Too Many Requests.
 * The retryAfterSeconds value is embedded in the response body for client use;
 * the `Retry-After` HTTP header is set by the global rate-limit exception filter.
 */
export class RateLimitExceededException extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds = 60) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: `Too many attempts. Please retry after ${retryAfterSeconds} seconds.`,
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class MfaEnrollmentRequiredException extends ForbiddenException {
  constructor() {
    super('Multi-factor authentication is required for your organization. Enable MFA in account security settings.');
  }
}

export class MaintenanceModeException extends HttpException {
  constructor() {
    super(
      {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Service Unavailable',
        message: 'The clinic is in maintenance mode. Only administrators may sign in.',
        code: 'MAINTENANCE_MODE',
      },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }
}
