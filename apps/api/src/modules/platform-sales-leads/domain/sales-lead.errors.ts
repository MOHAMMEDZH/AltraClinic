/** Flexible Step 24 — typed HTTP-mappable errors for the sales lead domain. */
export class SalesLeadError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly httpStatus: number,
  ) {
    super(message);
    this.name = 'SalesLeadError';
  }
}

export class SalesLeadNotFoundError extends SalesLeadError {
  constructor(message = 'Not found.') {
    super('not_found', message, 404);
  }
}

export class SalesLeadConflictError extends SalesLeadError {
  constructor(message = 'Conflict.') {
    super('conflict', message, 409);
  }
}

export class SalesLeadForbiddenError extends SalesLeadError {
  constructor(message = 'Forbidden.') {
    super('forbidden', message, 403);
  }
}

export class SalesLeadValidationError extends SalesLeadError {
  constructor(message = 'Invalid request.') {
    super('validation_error', message, 400);
  }
}
