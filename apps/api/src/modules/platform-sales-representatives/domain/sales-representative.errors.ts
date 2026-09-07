/** Flexible Step 23 — typed HTTP-mappable errors for the sales representative domain. */
export class SalesRepError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'SalesRepError';
  }
}

export class SalesRepNotFoundError extends SalesRepError {
  constructor(message = 'Not found.') {
    super('not_found', message, 404);
  }
}

export class SalesRepConflictError extends SalesRepError {
  constructor(message = 'Conflict.') {
    super('conflict', message, 409);
  }
}

export class SalesRepForbiddenError extends SalesRepError {
  constructor(message = 'Forbidden.') {
    super('forbidden', message, 403);
  }
}

export class SalesRepValidationError extends SalesRepError {
  constructor(message = 'Invalid request.') {
    super('validation_error', message, 400);
  }
}
