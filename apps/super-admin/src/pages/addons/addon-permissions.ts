import type { PlatformPrincipal } from '../../auth/platform-auth-api';
import { hasAnyPermission, hasPermission } from '../../auth/permissions';

export function canViewAddOns(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'addon.view');
}

export function canManageAddOns(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'addon.manage');
}

export function canViewOverrides(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'override.view');
}

export function canRequestOverrides(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'override.request');
}

export function canApproveOverrides(principal: PlatformPrincipal | null): boolean {
  return hasPermission(principal, 'override.approve');
}

export function canPreviewComposition(principal: PlatformPrincipal | null): boolean {
  return hasAnyPermission(principal, ['addon.view', 'override.view', 'plan.view']);
}
