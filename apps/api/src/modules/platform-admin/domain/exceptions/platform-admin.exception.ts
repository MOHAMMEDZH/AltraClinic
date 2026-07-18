import { BaseError } from '../../../../common/error.base';

/**
 * Base class for all Super Admin Platform domain invariant violations. It is
 * mapped to the appropriate HTTP status by the API boundary
 * ({@link PlatformAdminDomainExceptionFilter}).
 *
 * Concrete violations are raised as one of the two semantic subclasses so the
 * boundary can choose the correct status WITHOUT inspecting the (human-readable,
 * localizable) message text:
 *  - {@link PlatformAdminStateError}      → 409 Conflict (illegal lifecycle/state
 *                                           transition, duplicate, or capacity
 *                                           breach).
 *  - {@link PlatformAdminValidationError} → 422 Unprocessable Entity (malformed
 *                                           or missing input, or a business-rule
 *                                           breach such as separation-of-duties).
 */
export abstract class PlatformAdminError extends BaseError {
  /** Discriminator used by the API boundary to pick an HTTP status. */
  abstract readonly kind: 'state' | 'validation';

  protected constructor(code: string, message: string, metadata?: Record<string, unknown>) {
    super(code, message, metadata);
  }
}

/** A request that conflicts with the aggregate's current state (→ 409). */
export class PlatformAdminStateError extends PlatformAdminError {
  readonly kind = 'state' as const;

  constructor(message: string, metadata?: Record<string, unknown>) {
    super('platform_admin_state_error', message, metadata);
  }
}

/** A request carrying input that violates a domain invariant (→ 422). */
export class PlatformAdminValidationError extends PlatformAdminError {
  readonly kind = 'validation' as const;

  constructor(message: string, metadata?: Record<string, unknown>) {
    super('platform_admin_validation_error', message, metadata);
  }
}
