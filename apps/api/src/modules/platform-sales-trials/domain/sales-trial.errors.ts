/** Flexible Step 25 — typed HTTP-mappable errors for the governed Trial domain. */
export class SalesTrialError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'SalesTrialError';
  }
}

export class SalesTrialNotFoundError extends SalesTrialError {
  constructor(message = 'Not found.') {
    super('not_found', message, 404);
  }
}

export class SalesTrialConflictError extends SalesTrialError {
  constructor(message = 'Conflict.', code = 'conflict') {
    super(code, message, 409);
  }
}

export class SalesTrialForbiddenError extends SalesTrialError {
  constructor(message = 'Forbidden.') {
    super('forbidden', message, 403);
  }
}

export class SalesTrialValidationError extends SalesTrialError {
  constructor(message = 'Invalid request.', code = 'validation_error') {
    super(code, message, 400);
  }
}
