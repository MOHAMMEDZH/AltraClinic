import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Global JWT authentication guard.
 * - Skips routes decorated with @Public()
 * - For all other routes, validates the Bearer token via JwtStrategy
 *
 * COMPETING ARCHITECT:
 *   Challenger: "Applying globally with @UseGuards(JwtAuthGuard) at app level
 *   might interfere with WebSocket or health-check endpoints."
 *   Decision: Registered as a global APP_GUARD in AppModule. Health/metrics
 *   endpoints should use @Public(). This is simpler than opt-in per-controller
 *   and eliminates the risk of unguarded endpoints shipping to production.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw new UnauthorizedException('Authentication required. Provide a valid Bearer token.');
    }
    return user;
  }
}
