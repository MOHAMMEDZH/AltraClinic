import { PlatformAdminValidationError } from '../exceptions/platform-admin.exception';
import {
  ENTITLEMENT_PLANS,
  EntitlementLimits,
  EntitlementPlan,
  normalizeEntitlementPlan,
} from './entitlement-plan';

/**
 * Immutable value object wrapping a tenant's entitlement plan and the resource
 * quotas it confers. Centralizing the plan→limits mapping here keeps quota logic
 * in one place and out of handlers/UI.
 */
export class EntitlementPlanVO {
  private static readonly LIMITS: Record<EntitlementPlan, EntitlementLimits> = {
    starter: { maxBranches: 1, maxUsers: 10 },
    growth: { maxBranches: 5, maxUsers: 50 },
    enterprise: { maxBranches: null, maxUsers: null },
  };

  private readonly _value: EntitlementPlan;

  constructor(value: string) {
    const normalized = normalizeEntitlementPlan(value);
    if (!normalized) {
      throw new PlatformAdminValidationError(
        `Invalid entitlement plan: ${value}. Supported plans: ${ENTITLEMENT_PLANS.join(', ')}`,
      );
    }
    this._value = normalized;
  }

  get value(): EntitlementPlan {
    return this._value;
  }

  get limits(): EntitlementLimits {
    return EntitlementPlanVO.LIMITS[this._value];
  }

  equals(other: EntitlementPlanVO): boolean {
    return this._value === other._value;
  }
}
