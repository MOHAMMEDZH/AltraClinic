import { SetMetadata } from '@nestjs/common';

export const IS_PLATFORM_AUTH_ROUTE_KEY = 'isPlatformAuthRoute';

/**
 * Marks a route as belonging to the platform authentication / control-plane boundary.
 * Platform JWTs are accepted only on these routes; tenant/patient JWTs are rejected.
 */
export const PlatformAuthRoute = () => SetMetadata(IS_PLATFORM_AUTH_ROUTE_KEY, true);
