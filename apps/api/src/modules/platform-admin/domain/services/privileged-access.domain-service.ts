import { PlatformTenant } from '../entities/platform-tenant.entity';
import { PrivilegedAccessScope } from '../value-objects/privileged-access-scope';

export interface PrivilegedAccessDecision {
  readonly allowed: boolean;
  readonly reason:
    | 'granted'
    | 'tenant_archived'
    | 'no_active_grant'
    | 'scope_not_granted';
}

/**
 * Stateless domain service that answers a single cross-entity question:
 * "may this platform administrator exercise this scope inside this tenant right
 * now?" — used by downstream control-plane operations to enforce JIT access.
 *
 * The decision spans the aggregate's status and its privileged grants, so it
 * belongs to no single entity. Keeping it pure makes the authorization rule
 * explicit, unit-testable, and free of infrastructure.
 */
export class PrivilegedAccessDomainService {
  decide(
    platformTenant: PlatformTenant,
    adminId: string,
    scope: PrivilegedAccessScope,
    at: Date = new Date(),
  ): PrivilegedAccessDecision {
    if (platformTenant.status.value === 'archived') {
      return { allowed: false, reason: 'tenant_archived' };
    }

    const normalizedAdminId = adminId?.trim() ?? '';
    const matching = platformTenant
      .activePrivilegedGrants(at)
      .filter((grant) => grant.adminId === normalizedAdminId);

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
