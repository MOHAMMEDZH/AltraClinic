import type { PlatformPrincipal } from '../../auth/platform-auth-api';
import { hasPermission } from '../../auth/permissions';

export function canViewSubscriptions(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'subscription.view');
}

export function canAssignSubscriptions(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'subscription.assign');
}

export function canMigrateSubscriptions(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'subscription.migrate');
}

export function canSuspendSubscriptions(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'subscription.suspend');
}

export function canCancelSubscriptions(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'subscription.cancel');
}
