import { evaluatePermissionPolicy, type PolicyPrincipal } from './permission-policy';
import { getRouteById, listNavRoutes } from './route-registry';

/**
 * Chooses where an authenticated principal should land by default (index
 * route, post-login redirect, etc). Overview first (it only requires being
 * authenticated), then the first permission-eligible nav route, and finally
 * the personal security page — every platform user can always reach that.
 */
export function resolveDefaultRoutePath(principal: PolicyPrincipal | null): string {
  const overview = getRouteById('overview');
  if (overview && evaluatePermissionPolicy(principal, overview.policy)) {
    return overview.path;
  }

  const [firstNavRoute] = listNavRoutes(principal);
  if (firstNavRoute) {
    return firstNavRoute.path;
  }

  return '/security';
}
