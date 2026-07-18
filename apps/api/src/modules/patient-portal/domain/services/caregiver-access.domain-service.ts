import { PortalAccount } from '../entities/portal-account.entity';
import { CaregiverAccessScope } from '../value-objects/caregiver-access-scope';

export interface CaregiverAccessDecision {
  readonly allowed: boolean;
  readonly reason:
    | 'granted'
    | 'account_not_active'
    | 'no_active_grant'
    | 'scope_not_granted';
}

/**
 * Stateless domain service that answers a single cross-entity question:
 * "may this caregiver read this scope of this portal account right now?"
 *
 * The decision spans the aggregate's status and its caregiver grants, so it does
 * not belong to any single entity. Keeping it as a pure function makes the
 * authorization rule explicit, unit-testable, and free of infrastructure.
 */
export class CaregiverAccessDomainService {
  decide(
    account: PortalAccount,
    caregiverContact: string,
    scope: CaregiverAccessScope,
    at: Date = new Date(),
  ): CaregiverAccessDecision {
    if (account.status.value !== 'active') {
      return { allowed: false, reason: 'account_not_active' };
    }

    const normalizedContact = caregiverContact?.trim().toLowerCase() ?? '';
    const matching = account
      .activeCaregiverGrants(at)
      .filter((grant) => grant.caregiverContact.toLowerCase() === normalizedContact);

    if (matching.length === 0) {
      return { allowed: false, reason: 'no_active_grant' };
    }

    const hasScope = matching.some((grant) => grant.hasScope(scope));
    if (!hasScope) {
      return { allowed: false, reason: 'scope_not_granted' };
    }

    return { allowed: true, reason: 'granted' };
  }
}
