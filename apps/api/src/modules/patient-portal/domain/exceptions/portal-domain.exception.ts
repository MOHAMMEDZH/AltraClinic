import { BaseError } from '../../../../common/error.base';

/**
 * Base class for all Patient Portal domain invariant violations. It is mapped to
 * the appropriate HTTP status by the API boundary
 * ({@link PortalDomainExceptionFilter}).
 *
 * Concrete violations are raised as one of the two semantic subclasses so the
 * boundary can choose the correct status WITHOUT inspecting the (human-readable,
 * localizable) message text:
 *  - {@link PortalStateError}      → 409 Conflict (illegal lifecycle/state
 *                                    transition, duplicate, or capacity breach).
 *  - {@link PortalValidationError} → 422 Unprocessable Entity (malformed or
 *                                    missing input that violates an invariant).
 */
export abstract class PortalDomainError extends BaseError {
  /** Discriminator used by the API boundary to pick an HTTP status. */
  abstract readonly kind: 'state' | 'validation';

  protected constructor(code: string, message: string, metadata?: Record<string, unknown>) {
    super(code, message, metadata);
  }
}

/** A request that conflicts with the aggregate's current state (→ 409). */
export class PortalStateError extends PortalDomainError {
  readonly kind = 'state' as const;

  constructor(message: string, metadata?: Record<string, unknown>) {
    super('patient_portal_state_error', message, metadata);
  }
}

/** A request carrying input that violates a domain invariant (→ 422). */
export class PortalValidationError extends PortalDomainError {
  readonly kind = 'validation' as const;

  constructor(message: string, metadata?: Record<string, unknown>) {
    super('patient_portal_validation_error', message, metadata);
  }
}
