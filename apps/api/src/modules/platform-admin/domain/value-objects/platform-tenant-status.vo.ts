import { PlatformAdminValidationError } from '../exceptions/platform-admin.exception';
import { PlatformTenantStatus, isPlatformTenantStatus } from './platform-tenant-status';

/**
 * Immutable value object wrapping the operational lifecycle status of a platform
 * tenant. Validation lives here so an invalid status can never enter the domain.
 */
export class PlatformTenantStatusVO {
  private readonly _value: PlatformTenantStatus;

  constructor(value: string) {
    if (!isPlatformTenantStatus(value)) {
      throw new PlatformAdminValidationError(`Invalid platform tenant status: ${value}`);
    }
    this._value = value;
  }

  get value(): PlatformTenantStatus {
    return this._value;
  }

  equals(other: PlatformTenantStatusVO): boolean {
    return this._value === other._value;
  }
}
