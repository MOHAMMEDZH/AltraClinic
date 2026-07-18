import { Injectable } from '@nestjs/common';
import type { AuthenticatedPrincipal } from '../../../common/authenticated-principal.util';

const VIEW_ROLES = new Set([
  'super_admin',
  'owner',
  'general_manager',
  'specialist',
  'assistant',
  'receptionist',
]);

const MUTATE_ROLES = new Set([
  'super_admin',
  'owner',
  'general_manager',
  'specialist',
  'assistant',
]);

const APPROVE_ROLES = new Set(['super_admin', 'owner', 'general_manager']);

@Injectable()
export class BeautyPolicyService {
  private hasRole(user: AuthenticatedPrincipal | null, allowed: Set<string>): boolean {
    if (!user?.id || !user.roles?.length) return false;
    return user.roles.some((r) => allowed.has(r));
  }

  canAccess(user: AuthenticatedPrincipal | null, _req: unknown): boolean {
    return this.hasRole(user, VIEW_ROLES);
  }

  canView(user: AuthenticatedPrincipal | null): boolean {
    return this.hasRole(user, VIEW_ROLES);
  }

  canMutate(user: AuthenticatedPrincipal | null): boolean {
    return this.hasRole(user, MUTATE_ROLES);
  }

  canApprove(user: AuthenticatedPrincipal | null): boolean {
    return this.hasRole(user, APPROVE_ROLES);
  }
}
