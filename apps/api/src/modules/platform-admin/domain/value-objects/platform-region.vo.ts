import { PlatformAdminValidationError } from '../exceptions/platform-admin.exception';
import { PlatformRegion, isPlatformRegion } from './platform-region';

/** Immutable value object wrapping a tenant's data-residency region. */
export class PlatformRegionVO {
  private readonly _value: PlatformRegion;

  constructor(value: string) {
    if (!isPlatformRegion(value)) {
      throw new PlatformAdminValidationError(`Invalid platform region: ${value}`);
    }
    this._value = value;
  }

  get value(): PlatformRegion {
    return this._value;
  }

  equals(other: PlatformRegionVO): boolean {
    return this._value === other._value;
  }
}
