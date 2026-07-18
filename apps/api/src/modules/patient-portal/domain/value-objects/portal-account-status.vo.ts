import { PortalValidationError } from '../exceptions/portal-domain.exception';
import { PortalAccountStatus, isPortalAccountStatus } from './portal-account-status';

/**
 * Immutable value object wrapping the lifecycle status of a portal account.
 * Validation lives here so that an invalid status can never enter the domain.
 */
export class PortalAccountStatusVO {
  private readonly _value: PortalAccountStatus;

  constructor(value: string) {
    if (!isPortalAccountStatus(value)) {
      throw new PortalValidationError(`Invalid portal account status: ${value}`);
    }
    this._value = value;
  }

  get value(): PortalAccountStatus {
    return this._value;
  }

  equals(other: PortalAccountStatusVO): boolean {
    return this._value === other._value;
  }
}
