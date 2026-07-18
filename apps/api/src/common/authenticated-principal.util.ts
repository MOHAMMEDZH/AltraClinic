import { UnauthorizedException } from '@nestjs/common';

export interface AuthenticatedPrincipalRequest {
  user?: { id?: unknown; sub?: unknown; roles?: unknown };
}

export interface AuthenticatedPrincipal {
  id: string;
  roles: string[];
}

/**
 * Extracts the authenticated principal from trusted middleware output
 * (`request.user`).
 *
 * Security boundary: this helper intentionally DOES NOT read identity/roles
 * from arbitrary request headers. Identity must come from a verified token and
 * upstream auth guard.
 */
export function requireAuthenticatedPrincipal(
  request: AuthenticatedPrincipalRequest,
  message: string = 'Authenticated user and roles are required',
): AuthenticatedPrincipal {
  const userId = String(request.user?.id ?? request.user?.sub ?? '').trim();
  const rolesSource = request.user?.roles;

  if (!userId || !rolesSource) {
    throw new UnauthorizedException(message);
  }

  const roles = (Array.isArray(rolesSource)
    ? rolesSource.map((role) => String(role))
    : String(rolesSource).split(',')
  )
    .map((role) => role.trim().toLowerCase())
    .filter(Boolean);

  if (roles.length === 0) {
    throw new UnauthorizedException(message);
  }

  return { id: userId, roles };
}