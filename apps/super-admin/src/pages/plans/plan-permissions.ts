import type { PlatformPrincipal } from '../../auth/platform-auth-api';
import { hasAnyPermission, hasPermission } from '../../auth/permissions';

/** Read entitlements on a Plan Version (`plan-entitlement.view` or legacy `entitlement.view`). */
export function canViewPlanEntitlements(principal: PlatformPrincipal | null): boolean {
  return hasAnyPermission(principal, ['plan-entitlement.view', 'entitlement.view']);
}

export function canManagePlanEntitlements(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'plan-entitlement.manage');
}

export function canViewPlanLimits(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'plan-limit.view');
}

export function canManagePlanLimits(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'plan-limit.manage');
}
