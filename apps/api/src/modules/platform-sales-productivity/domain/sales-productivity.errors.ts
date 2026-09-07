/** Flexible Step 26 — typed HTTP-mappable errors for productivity / commission snapshots. */
export class SalesProductivityError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'SalesProductivityError';
  }
}

export class SalesProductivityNotFoundError extends SalesProductivityError {
  constructor(message = 'Not found.') {
    super('not_found', message, 404);
  }
}

export class SalesProductivityConflictError extends SalesProductivityError {
  constructor(message = 'Conflict.', code = 'conflict') {
    super(code, message, 409);
  }
}

export class SalesProductivityForbiddenError extends SalesProductivityError {
  constructor(message = 'Forbidden.') {
    super('forbidden', message, 403);
  }
}

export class SalesProductivityValidationError extends SalesProductivityError {
  constructor(message = 'Invalid request.', code = 'validation_error') {
    super(code, message, 400);
  }
}
