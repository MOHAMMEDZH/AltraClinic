import type { PlatformPrincipal } from './platform-auth-api';

export function hasPermission(principal: PlatformPrincipal | null, key: string): boolean {
  return (principal?.permissions ?? []).includes(key);
}

export function hasAnyPermission(
  principal: PlatformPrincipal | null,
  keys: readonly string[],
): boolean {
  return keys.some((key) => hasPermission(principal, key));
}

export function hasAllPermissions(
  principal: PlatformPrincipal | null,
  keys: readonly string[],
): boolean {
  return keys.every((key) => hasPermission(principal, key));
}
