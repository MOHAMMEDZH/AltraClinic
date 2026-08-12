/** Flexible Step 27 — typed errors. */

export class PlatformNotificationError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'PlatformNotificationError';
  }
}

export class PlatformNotificationValidationError extends PlatformNotificationError {
  constructor(message = 'Invalid notification request.', code = 'validation_error') {
    super(code, message, 400);
  }
}

export class PlatformNotificationForbiddenError extends PlatformNotificationError {
  constructor(message = 'Forbidden.') {
    super('forbidden', message, 403);
  }
}

export class PlatformNotificationNotFoundError extends PlatformNotificationError {
  constructor(message = 'Not found.') {
    super('not_found', message, 404);
  }
}

export class PlatformNotificationConflictError extends PlatformNotificationError {
  constructor(message = 'Conflict.', code = 'conflict') {
    super(code, message, 409);
  }
}
