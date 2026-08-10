/**
 * Step 09 — Super Admin permission policy model.
 *
 * Route access is decided purely from permission *keys* carried on the
 * authenticated principal. There is no role-name authorization anywhere in
 * this module — role names are display-only and must never gate access.
 *
 * All evaluation is fail-closed: malformed, unknown, or unrecognized policy
 * shapes deny access rather than allow it. The only policy that grants
 * access unconditionally is `{ type: 'public' }`.
 */

export type PermissionPolicy =
  | { type: 'public' }
  | { type: 'authenticated' }
  | { type: 'permission'; permission: string }
  | { type: 'anyOf'; permissions: readonly string[] }
  | { type: 'allOf'; permissions: readonly string[] };

/**
 * Minimal shape this module depends on. Intentionally does not reference
 * `PlatformPrincipal` directly so the policy engine has no coupling to the
 * auth transport layer (and, crucially, no access to role names).
 */
export interface PolicyPrincipal {
  permissions?: string[];
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isNonEmptyStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isNonEmptyString);
}

function principalHasPermission(principal: PolicyPrincipal | null, key: string): boolean {
  if (!principal) return false;
  return Array.isArray(principal.permissions) && principal.permissions.includes(key);
}

/**
 * Evaluates a route/action policy against a principal (or `null` when
 * signed out). Accepts `unknown` for the policy argument so callers loading
 * policies from untrusted or loosely-typed sources (e.g. registries built
 * from data) still fail closed instead of throwing or defaulting to allow.
 */
export function evaluatePermissionPolicy(
  principal: PolicyPrincipal | null,
  policy: PermissionPolicy | unknown,
): boolean {
  if (typeof policy !== 'object' || policy === null) return false;
  const candidate = policy as Record<string, unknown>;

  switch (candidate.type) {
    case 'public':
      return true;
    case 'authenticated':
      return principal !== null;
    case 'permission':
      return isNonEmptyString(candidate.permission)
        ? principalHasPermission(principal, candidate.permission)
        : false;
    case 'anyOf':
      return isNonEmptyStringArray(candidate.permissions)
        ? candidate.permissions.some((key) => principalHasPermission(principal, key))
        : false;
    case 'allOf':
      return isNonEmptyStringArray(candidate.permissions)
        ? candidate.permissions.every((key) => principalHasPermission(principal, key))
        : false;
    default:
      // Unknown/malformed policy shapes fail closed.
      return false;
  }
}

/** Type guard used by registry integrity checks and tests. */
export function isValidPermissionPolicy(policy: unknown): policy is PermissionPolicy {
  if (typeof policy !== 'object' || policy === null) return false;
  const candidate = policy as Record<string, unknown>;
  switch (candidate.type) {
    case 'public':
    case 'authenticated':
      return true;
    case 'permission':
      return isNonEmptyString(candidate.permission);
    case 'anyOf':
    case 'allOf':
      return isNonEmptyStringArray(candidate.permissions);
    default:
      return false;
  }
}
